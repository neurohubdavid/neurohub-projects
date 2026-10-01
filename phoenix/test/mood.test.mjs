// How Phoenix's body responds to words (local, gentle guesses that only change how the mascot looks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodFor, replyMood, actFor, lookFor } from '../app/js/mood.js';

test('mood: feelings in what someone types or says', () => {
  const cases = {
    sad: ['I feel so lonely today', 'I have been crying all morning', 'everything feels hopeless', 'I want to end it all'],
    calm: ['I am so overwhelmed', 'I think I am heading for a meltdown', 'my anxiety is awful', 'I am burnt out', 'so frustrated with my boss'],
    happy: ['I finally did it!!', 'thank you so much', 'that really helped', 'I am so proud of myself', 'good news, I got the job'],
    greet: ['hi', 'Hello there', 'good morning'],
    curious: ['what is monotropism?', 'how do I start my taxes', 'Can you explain masking'],
    alert: ['I NEED HELP RIGHT NOW'],
    neutral: ['', 'ok', 'I went to the shop and bought bread', '   '],
  };
  for (const [mood, texts] of Object.entries(cases)) for (const t of texts) assert.equal(moodFor(t), mood, `"${t}" should be ${mood}`);
});

test('mood: sadness and worry win over a question mark, and a long greeting-like message is not just "hello"', () => {
  assert.equal(moodFor('why am I so lonely?'), 'sad'); assert.equal(moodFor('how do I stop panicking?'), 'calm');
  assert.equal(moodFor('hello, I wanted to ask about how my sensory needs change through the week'), 'neutral');
});

test('mood: Phoenix shows the feeling of her own reply, and actions and looks are mapped sensibly', () => {
  assert.equal(replyMood('I’m so glad you told me. That is a big step.'), 'happy');
  assert.equal(replyMood('I\'m sorry, that sounds really exhausting.'), 'sad');
  assert.equal(replyMood('Here are three small steps you could try.'), 'neutral');
  assert.equal(actFor('greet'), 'wave'); assert.equal(actFor('sad'), ''); assert.equal(lookFor('greet'), 'happy'); assert.equal(lookFor('calm'), 'calm');
});
