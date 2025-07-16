# MoodleToAnki

A browser script to export Moodle quiz questions to Anki flashcards while preserving formatting and images.

## Before You Start

**Important Legal Notice:**  
Only use this tool for content you have explicit permission to save. This includes:
- Quizzes you've personally completed
- Practice materials explicitly shared by instructors
- Open educational resources

**What won't work:**  
- Quizzes where correct answers are hidden
- Exams with disabled review options
- Any protected content that requires special permissions

**Technical Requirements:**  
- You must have already completed the quiz (or have access to a completed attempt)
- Answers must be visible on the review page
- Works only on standard Moodle quiz formats

**How the Script Operates:**  
This tool works by recursively scanning through all pages of your quiz review, automatically:
1. Detecting questions and their correct answers
2. Preserving the original formatting
3. Compiling everything into an Anki-ready format
4. Handling pagination automatically

## How It Works

1. **Access the Quiz Review Page**:
   - Complete the quiz or access a previous attempt
   - Navigate to the detailed review page (typically: *Quiz → Attempts → Review*)
   - Verify you can see:
     - All questions
     - Answer options
     - Correct answers marked
     - Any explanations provided

2. **Run the Script**:
   - Open browser developer tools:
     - Chrome/Firefox: `F12` or `Ctrl+Shift+I` (Windows/Linux)
     - Safari: `Cmd+Opt+I` (must enable developer tools first)
   - Go to the Console tab
   - Paste the entire script and press Enter

3. **Export Process**:
   - The script will:
     - Scan through all question pages (showing progress in console)
     - Preserve text formatting and images where possible
     - Remove duplicate questions
   - When complete, a CSV file will automatically download
   - File is named after the quiz title (e.g., "Biochemistry-Quiz-2.csv")

4. **Import to Anki**:
   - Open Anki and select: *File → Import*
   - Choose the downloaded CSV file
   - Ensure "Allow HTML" is checked
   - Map fields to your card template (works best with Basic template)
   - For images: You may need to manually save and add some external images

## Troubleshooting

**Common Issues**:
- If the script stops early:
  - Refresh the page and try again
  - Check for console error messages
- Missing images:
  - Some external images may not export properly
  - You may need to save these manually
- Formatting problems:
  - Ensure "Allow HTML" is checked in Anki
  - Complex formatting may require manual adjustment

## Limitations

- This is currently only designed to work with multiple choice questions, I may release modified scripts for other question types in future
- May not handle all question types perfectly
- Large quizzes (50+ questions) may take several minutes
- Some external content (videos, interactive elements) won't export
- Requires answers to be visible in review

## Ethical Use

This tool is designed to:
- Help with personal study and revision
- Create flashcards from materials you already have access to
- Save time when preparing for exams

Please use responsibly and in accordance with:
- Copyright laws
- Your institution's academic policies
- Moodle's terms of service

Remember: This doesn't bypass any security - it simply automates what you could do manually by copying questions one-by-one.
