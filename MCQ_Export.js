(function() {
  // Automatically use current page URL as the base
  const currentURL = window.location.href;
  const urlObj = new URL(currentURL);
  
  // Extract required parameters from current URL
  const baseParams = {
    attempt: urlObj.searchParams.get('attempt'),
    cmid: urlObj.searchParams.get('cmid')
  };
  
  if (!baseParams.attempt || !baseParams.cmid) {
    alert("Error: Current page must be a Moodle quiz review with 'attempt' and 'cmid' parameters");
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

  function cleanHTML(html) {
    if (!html) return '';
    
    const div = document.createElement('div');
    div.innerHTML = html;
    
    const unwantedAttrs = ['style', 'class', 'id'];
    const elements = div.querySelectorAll('*');
    
    elements.forEach(el => {
      unwantedAttrs.forEach(attr => el.removeAttribute(attr));
      
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
        el.childNodes[0].textContent = el.childNodes[0].textContent
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    });
    
    const allowedTags = ['a', 'br', 'p', 'ul', 'ol', 'li', 'strong', 'em'];
    const preservedHTML = div.innerHTML.replace(/<\/?([^>]+)>/g, (match, tag) => {
      const tagName = tag.split(' ')[0].toLowerCase();
      return allowedTags.includes(tagName) ? match : '';
    });
    
    return preservedHTML
      .replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/g, '<a href="$1">$2</a>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function extractAllQuestions() {
    const allQuestions = [];
    let currentPage = 0;
    let previousContentHash = null;
    let duplicateCount = 0;
    const maxDuplicateThreshold = 2;

    const extractQuestionsFromHTML = html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const questions = [...doc.querySelectorAll('div.que.multichoice')].map(qDiv => {
        const questionText = cleanHTML(qDiv.querySelector('.qtext')?.innerHTML)
          .replace(/&nbsp;/g, ' ')
          .trim();
        
        const options = [...qDiv.querySelectorAll('.answer > div')].map(div =>
          cleanHTML(div.innerHTML)
            .replace(/^[a-dA-D]\.\s*/, '')
            .replace(/\b(Correct|Incorrect)\b/g, '')
            .trim()
        );
        
        const correct = cleanHTML(qDiv.querySelector('.rightanswer')?.innerHTML)
          .replace('The correct answer is:', '')
          .trim();
          
        const explanation = cleanHTML(qDiv.querySelector('.generalfeedback')?.innerHTML);
        
        return { 
          question: questionText, 
          options, 
          correct, 
          explanation,
          uniqueId: questionText?.substring(0, 50) + options.join('|').substring(0, 50)
        };
      });
      
      return {
        questions,
        contentHash: html.length
      };
    };

    console.log(`🚀 Starting extraction from current quiz: ${baseURL}`);
    
    while (true) {
      try {
        console.log(`📄 Fetching page ${currentPage}`);
        const res = await fetch(`${baseURL}${currentPage}`, { 
          credentials: 'same-origin',
          cache: 'no-store'
        });
        
        if (res.status === 404) {
          console.log("⏹️ Reached 404 - stopping");
          break;
        }
        
        const html = await res.text();
        
        if (html.includes("No questions found") || html.trim().length === 0) {
          console.log("⏹️ No questions found - stopping");
          break;
        }
        
        const { questions, contentHash } = extractQuestionsFromHTML(html);
        
        if (previousContentHash === contentHash) {
          duplicateCount++;
          if (duplicateCount >= maxDuplicateThreshold) {
            console.log("⏹️ Detected duplicate pages - stopping");
            break;
          }
        } else {
          duplicateCount = 0;
        }
        
        previousContentHash = contentHash;
        
        if (questions.length === 0) {
          console.log("⏹️ No questions extracted - stopping");
          break;
        }
        
        console.log(`✅ Page ${currentPage}: ${questions.length} questions saved`);
        allQuestions.push(...questions);
        currentPage++;
        await new Promise(res => setTimeout(res, 500 + Math.random() * 300));
        
      } catch (error) {
        console.error(`❌ Error on page ${currentPage}:`, error);
        break;
      }
    }

    // Remove duplicates
    const uniqueQuestions = [];
    const seenIds = new Set();
    for (const q of allQuestions) {
      if (!seenIds.has(q.uniqueId)) {
        seenIds.add(q.uniqueId);
        uniqueQuestions.push(q);
      }
    }

    // Format for Anki with single line break after question
    const csvData = uniqueQuestions.map(q => {
      const numberedOptions = q.options.map((opt, idx) => 
        `${String.fromCharCode(97 + idx)}. ${opt}`).join('<br>');
      
      // Changed to use single <br> between question and options
      const front = `${q.question}<br>${numberedOptions}`;
      const back = `<b>Correct Answer:</b> ${q.correct}<br><br><b>Explanation:</b><br>${q.explanation || "No explanation available"}`;
      
      return [
        `"${front.replace(/"/g, '""')}"`,
        `"${back.replace(/"/g, '""')}"`
      ].join(';');
    }).join('\r\n');

    const csvContent = '\uFEFF' + csvData;
    const quizName = document.title.replace(/[^\w\s]/gi, '').substring(0, 50) || "Moodle Quiz Export";
    downloadCSV(csvContent, `${quizName}.csv`);
    console.log(`✅ Done! Exported ${uniqueQuestions.length} questions`);
  }

  // Start extraction automatically
  extractAllQuestions();
})();
