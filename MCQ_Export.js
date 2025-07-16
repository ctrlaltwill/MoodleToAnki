(function () {
  const EMBED_IMAGES = true;
  const IMAGE_FETCH_TIMEOUT = 5000;
 
  const currentURL = window.location.href;
  const urlObj = new URL(currentURL);
  const baseParams = {
    attempt: urlObj.searchParams.get('attempt'),
    cmid: urlObj.searchParams.get('cmid')
  };
 
  if (!baseParams.attempt || !baseParams.cmid) {
    alert("Error: Must be on a Moodle quiz review page with attempt and cmid parameters");
    return;
  }
 
  const baseURL = `${urlObj.origin}${urlObj.pathname}?attempt=${baseParams.attempt}&cmid=${baseParams.cmid}&page=`;
 
  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
 
  async function getImageAsBase64(imgUrl) {
    if (imgUrl.startsWith('blob:')) {
      console.log("Skipping blob URL - can't embed directly");
      return imgUrl;
    }
 
    const secureUrl = imgUrl.replace(/^http:/, 'https:');
 
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Image fetch timeout')), IMAGE_FETCH_TIMEOUT)
      );
 
      const fetchPromise = fetch(secureUrl, {
        credentials: 'include',
        mode: 'no-cors',
        referrerPolicy: 'no-referrer'
      });
 
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const blob = await response.blob();
 
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => {
          console.log("FileReader failed, using original URL");
          resolve(imgUrl);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn(`Couldn't embed image (${secureUrl}), using original URL:`, error.message);
      return imgUrl;
    }
  }
 
  async function cleanHTML(html) {
    if (!html) return '';
 
    const div = document.createElement('div');
    div.innerHTML = html;
 
    if (EMBED_IMAGES) {
      const images = div.querySelectorAll('img');
      for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
          try {
            img.src = await getImageAsBase64(img.src);
          } catch (error) {
            console.warn("Image processing error:", error);
          }
        }
      }
    }
 
    const unwantedAttrs = ['style', 'class', 'id'];
    const elements = div.querySelectorAll('*');
    elements.forEach(el => unwantedAttrs.forEach(attr => el.removeAttribute(attr)));
 
    const allowedTags = ['a', 'br', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'img'];
    const preservedHTML = div.innerHTML.replace(/<\/?([^>]+)>/g, (match, tag) => {
      const tagName = tag.split(' ')[0].toLowerCase();
      return allowedTags.includes(tagName) ? match : '';
    });
 
    return preservedHTML
      .replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/g, '<a href="$1">$2</a>')
      .replace(/\s+/g, ' ')
      .trim();
  }
 
  function normaliseSpacing(text) {
    return text
      .replace(/\r/g, '')
      .replace(/(&nbsp;|\u00A0)/g, ' ')
      .replace(/\n[ \t]+\n/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*\n+/g, '')
      .replace(/\n+\s*$/, '')
      .replace(/(Explanation:)\s*/i, '');
  }
 
  async function extractAllQuestions() {
    const allQuestions = [];
    let currentPage = 0;
    let previousContentHash = null;
    let duplicateCount = 0;
    const maxDuplicateThreshold = 2;
 
    const extractQuestionsFromHTML = async (html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const questions = [];
 
      for (const qDiv of doc.querySelectorAll('div.que.multichoice')) {
        const questionHTML = qDiv.querySelector('.qtext')?.innerHTML || '';
        const questionText = await cleanHTML(questionHTML);
 
        const answerDivs = [...qDiv.querySelectorAll('.answer > div')];
        const options = await Promise.all(answerDivs.map(async (div) => {
          const raw = await cleanHTML(div.innerText || div.textContent || '');
          const stripped = raw
            .replace(/^[a-dA-D]\.\s*/i, '')
            .replace(/\b(Correct|Incorrect)\b/g, '')
            .trim();
          return stripped;
        }));
 
        const correctHTML = qDiv.querySelector('.rightanswer')?.innerHTML || '';
        const correct = (await cleanHTML(correctHTML))
          .replace('The correct answer is:', '')
          .trim();
 
        const explanationHTML = qDiv.querySelector('.generalfeedback')?.innerHTML || '';
        const explanation = await cleanHTML(explanationHTML);
 
        questions.push({
          question: questionText,
          options,
          correct,
          explanation,
          uniqueId: questionText?.substring(0, 50) + options.join('|').substring(0, 50)
        });
      }
 
      return {
        questions,
        contentHash: html.length
      };
    };
 
    console.log(`🟢 Starting quiz extraction from: ${baseURL}`);
 
    while (true) {
      try {
        console.log(`🔄 Processing page ${currentPage}...`);
        const res = await fetch(`${baseURL}${currentPage}`, {
          credentials: 'same-origin',
          cache: 'no-store'
        });
 
        if (res.status === 404) {
          console.log("📭 No more pages (404). Stopping.");
          break;
        }
 
        const html = await res.text();
 
        if (html.includes("No questions found") || html.trim().length === 0) {
          console.log("📭 No questions found on page.");
          break;
        }
 
        const { questions, contentHash } = await extractQuestionsFromHTML(html);
 
        if (previousContentHash === contentHash) {
          duplicateCount++;
          console.log(`⚠️ Detected duplicate content on page ${currentPage} (${duplicateCount})`);
          if (duplicateCount >= maxDuplicateThreshold) {
            console.log("🛑 Reached duplicate threshold. Ending scrape.");
            break;
          }
        } else {
          duplicateCount = 0;
        }
 
        previousContentHash = contentHash;
 
        if (questions.length === 0) {
          console.log(`⚠️ Page ${currentPage} had no valid questions.`);
          break;
        }
 
        console.log(`✅ Saved ${questions.length} questions from page ${currentPage}`);
        allQuestions.push(...questions);
        currentPage++;
        await new Promise(res => setTimeout(res, 500 + Math.random() * 300));
 
      } catch (error) {
        console.error(`❌ Error on page ${currentPage}:`, error);
        break;
      }
    }
 
    const uniqueQuestions = [];
    const seenIds = new Set();
    for (const q of allQuestions) {
      if (!seenIds.has(q.uniqueId)) {
        seenIds.add(q.uniqueId);
        uniqueQuestions.push(q);
      }
    }
 
    console.log(`📦 Total unique questions saved: ${uniqueQuestions.length}`);
 
    const csvData = uniqueQuestions.map(q => {
      const optionListHTML = '<ol>' + q.options.map(opt => `<li>${opt}</li>`).join('') + '</ol>';
      const front = `${q.question}${optionListHTML}`; // ❌ No <br> before <ol>
      const back = `<b>Correct Answer:</b> ${q.correct}<br>${q.explanation || "No further explanation provided"}`;
      return [
        `"${front.replace(/"/g, '""')}"`,
        `"${back.replace(/"/g, '""')}"`
      ].join(';');
    }).join('\r\n');
 
    const csvContent = '\uFEFF' + csvData;
    const quizName = document.title.replace(/[^\w\s]/gi, '').substring(0, 50) || "Moodle_Quiz_Export";
    downloadCSV(csvContent, `${quizName}.csv`);
    console.log(`📁 Export complete! File downloaded: ${quizName}.csv`);
 
    return uniqueQuestions.length;
  }
 
  extractAllQuestions()
    .then(count => console.log(`🎉 Done! Extracted ${count} unique questions.`))
    .catch(err => console.error("❌ Fatal error:", err));
})();
