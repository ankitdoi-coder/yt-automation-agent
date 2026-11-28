'use strict';

const path = require('path');
const { renderQuizBatch } = require('../../quiz-renderer');
const quiz = require('./quiz.json');

async function main() {
  const samples = quiz.questions.slice(0, 2).map((q) => ({
    ...q,
    subject: quiz.subject,
    subjectSub: quiz.subjectSub,
    part: quiz.part,
    question: q.question,
    answerIndex: q.correct_index,
    explanation: q.fact,
  }));
  const results = await renderQuizBatch(samples, {
    profile: 'reel-9x16',
    questionOutPath: (i) => path.join(__dirname, 'samples', `sample-${i + 1}-question.png`),
    answerOutPath: (i) => path.join(__dirname, 'samples', `sample-${i + 1}-answer.png`),
  });
  console.log(`Rendered ${results.length} sample question/answer pairs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
