/**
 * Facebook Reels Automation & Discovery Feed Publishing Test Suite
 * Tests:
 * 1. FacebookUploader initialization & credential validation
 * 2. Meta 3-step Reels Publishing API (start, rupload binary, finish as PUBLISHED)
 * 3. Fallback and timeline upload options
 * 4. Audio Effects procedural sound synthesizer (WAV headers, tick-tock, suspense BGM, chime)
 * 5. Audio asset initialization and directory caching
 * 6. FacebookVideoMaker layout SVG rendering and audio integration
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { FacebookUploader } = require('../facebook/fb-uploader');
const { FacebookVideoMaker } = require('../facebook/video-maker');
const {
  createWavHeader,
  generateTickTockWav,
  generateSuspenseBgmWav,
  generateChimeWav,
  ensureAudioAssets,
} = require('../facebook/audio-effects');

async function runTests() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('🧪 FACEBOOK REELS & DISCOVERY FEED AUTOMATION TEST SUITE');
  console.log('════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ ${name} - PASSED`);
      passed++;
    } catch (err) {
      console.error(`❌ ${name} - FAILED:`, err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ ${name} - PASSED`);
      passed++;
    } catch (err) {
      console.error(`❌ ${name} - FAILED:`, err.message);
      throw err;
    }
  }

  // ----------------------------------------------------
  // Test 1: FacebookUploader constructor validation
  // ----------------------------------------------------
  test('FacebookUploader constructor validates missing credentials', () => {
    const origPageId = process.env.FB_PAGE_ID;
    const origToken = process.env.FB_PAGE_ACCESS_TOKEN;
    try {
      delete process.env.FB_PAGE_ID;
      delete process.env.FB_PAGE_ACCESS_TOKEN;
      assert.throws(
        () => new FacebookUploader(null, null),
        /FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN must be configured/
      );
    } finally {
      process.env.FB_PAGE_ID = origPageId;
      process.env.FB_PAGE_ACCESS_TOKEN = origToken;
    }

    const uploader = new FacebookUploader('test_page_123', 'test_token_abc');
    assert.strictEqual(uploader.pageId, 'test_page_123');
    assert.strictEqual(uploader.accessToken, 'test_token_abc');
  });

  // ----------------------------------------------------
  // Test 2: Audio Effects - WAV Header Generation
  // ----------------------------------------------------
  test('Audio Effects: createWavHeader produces valid 44-byte RIFF header', () => {
    const sampleRate = 44100;
    const numSamples = 44100; // 1 second
    const header = createWavHeader(numSamples, sampleRate, 1, 16);

    assert.strictEqual(header.length, 44);
    assert.strictEqual(header.toString('ascii', 0, 4), 'RIFF');
    assert.strictEqual(header.toString('ascii', 8, 12), 'WAVE');
    assert.strictEqual(header.toString('ascii', 12, 16), 'fmt ');
    assert.strictEqual(header.readUInt16LE(20), 1); // PCM format
    assert.strictEqual(header.readUInt16LE(22), 1); // 1 channel
    assert.strictEqual(header.readUInt32LE(24), 44100); // sample rate
    assert.strictEqual(header.readUInt16LE(34), 16); // 16 bits per sample
    assert.strictEqual(header.toString('ascii', 36, 40), 'data');
    assert.strictEqual(header.readUInt32LE(40), numSamples * 2); // 88200 data bytes
  });

  // ----------------------------------------------------
  // Test 3: Audio Effects - Sound Generators
  // ----------------------------------------------------
  test('Audio Effects: Sound generators produce valid non-silent audio buffers', () => {
    const tickWav = generateTickTockWav(1);
    assert.ok(tickWav.length > 44, 'Tick tock wav should have audio bytes');
    assert.strictEqual(tickWav.length, 44 + 44100 * 2);

    const bgmWav = generateSuspenseBgmWav(1);
    assert.ok(bgmWav.length > 44, 'BGM wav should have audio bytes');
    assert.strictEqual(bgmWav.length, 44 + 44100 * 2);

    const chimeWav = generateChimeWav(1);
    assert.ok(chimeWav.length > 44, 'Chime wav should have audio bytes');
    assert.strictEqual(chimeWav.length, 44 + 44100 * 2);
  });

  // ----------------------------------------------------
  // Test 4: Audio Effects - Asset Caching & Directory Setup
  // ----------------------------------------------------
  test('Audio Effects: ensureAudioAssets verifies or creates audio files in assets/audio', () => {
    const assets = ensureAudioAssets();
    assert.ok(assets.bgmPath, 'BGM path should be returned');
    assert.ok(assets.tickTockPath, 'Tick tock path should be returned');
    assert.ok(assets.chimePath, 'Chime path should be returned');

    assert.ok(fs.existsSync(assets.bgmPath), `BGM file must exist: ${assets.bgmPath}`);
    assert.ok(fs.existsSync(assets.tickTockPath), `Tick tock file must exist: ${assets.tickTockPath}`);
    assert.ok(fs.existsSync(assets.chimePath), `Chime file must exist: ${assets.chimePath}`);

    assert.ok(fs.statSync(assets.bgmPath).size > 1000);
    assert.ok(fs.statSync(assets.tickTockPath).size > 1000);
    assert.ok(fs.statSync(assets.chimePath).size > 1000);
  });

  // ----------------------------------------------------
  // Test 5: Meta Reels Publishing API - 3-Step Flow Mock
  // ----------------------------------------------------
  await testAsync('Meta Reels API: publishReel executes Step 1, Step 2, and Step 3', async () => {
    const uploader = new FacebookUploader('test_page_100', 'test_token_secret');

    // Create a temporary dummy mp4 file
    const tempVideo = path.resolve(__dirname, '../temp/test_mock_video.mp4');
    fs.writeFileSync(tempVideo, Buffer.alloc(1024, 0));

    const calls = [];
    const originalPost = axios.post;
    const originalGet = axios.get;

    try {
      axios.post = async (url, data, config) => {
        calls.push({ method: 'POST', url, data, config });

        // Step 1: Start phase on video_reels
        if (url.includes('/video_reels') && config?.params?.upload_phase === 'start') {
          return {
            status: 200,
            data: {
              video_id: 'reel_vid_999888',
              upload_url: 'https://rupload.facebook.com/video-upload/v21.0/reel_vid_999888',
            },
          };
        }

        // Step 2: Binary transfer to rupload
        if (url.includes('rupload.facebook.com')) {
          assert.strictEqual(config?.headers?.['offset'], '0');
          assert.strictEqual(config?.headers?.['file_size'], '1024');
          assert.strictEqual(config?.headers?.['Content-Length'], '1024');
          assert.strictEqual(config?.headers?.['Authorization'], 'OAuth test_token_secret');
          if (data && typeof data.resume === 'function') {
            await new Promise(r => {
              data.on('close', r);
              data.on('end', r);
              data.on('error', () => r());
              data.resume();
            });
          }
          return { status: 200, data: { success: true } };
        }

        // Step 3: Finish phase on video_reels
        if (url.includes('/video_reels') && config?.params?.upload_phase === 'finish') {
          assert.strictEqual(config?.params?.video_id, 'reel_vid_999888');
          assert.strictEqual(config?.params?.video_state, 'PUBLISHED');
          return { status: 200, data: { success: true } };
        }

        throw new Error(`Unexpected POST url: ${url}`);
      };

      axios.get = async (url) => {
        calls.push({ method: 'GET', url });
        return {
          status: 200,
          data: { status: { video_status: 'ready' } },
        };
      };

      const result = await uploader.publishReel(tempVideo, {
        title: 'भारत का सबसे बड़ा राज्य कौन सा है?',
        description: 'भारत का सबसे बड़ा राज्य कौन सा है? #shorts #reels',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.id, 'reel_vid_999888');
      assert.strictEqual(result.url, 'https://www.facebook.com/reel/reel_vid_999888');
      assert.strictEqual(result.reelsFeed, true);
      assert.strictEqual(result.mode, 'REELS_DISCOVERY_FEED');

      // Verify the 3 steps were invoked in order
      assert.strictEqual(calls.length, 4); // Step 1 POST, Step 2 POST, Step 3 POST, Status GET
      assert.ok(calls[0].url.includes('/test_page_100/video_reels'));
      assert.strictEqual(calls[0].config.params.upload_phase, 'start');

      assert.ok(calls[1].url.includes('rupload.facebook.com/video-upload/v21.0/reel_vid_999888'));

      assert.ok(calls[2].url.includes('/test_page_100/video_reels'));
      assert.strictEqual(calls[2].config.params.upload_phase, 'finish');
      assert.strictEqual(calls[2].config.params.video_state, 'PUBLISHED');
    } finally {
      axios.post = originalPost;
      axios.get = originalGet;
      if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    }
  });

  // ----------------------------------------------------
  // Test 6: uploadVideo routes to Reels Discovery Feed by default
  // ----------------------------------------------------
  await testAsync('uploadVideo routes to publishReel (Discovery Feed) by default', async () => {
    const uploader = new FacebookUploader('test_page_100', 'test_token_secret');
    let publishReelCalled = false;
    uploader.publishReel = async () => {
      publishReelCalled = true;
      return { success: true, mode: 'REELS_DISCOVERY_FEED' };
    };

    const res = await uploader.uploadVideo('any_dummy_path.mp4', { title: 'Test' });
    assert.strictEqual(publishReelCalled, true);
    assert.strictEqual(res.mode, 'REELS_DISCOVERY_FEED');
  });

  // ----------------------------------------------------
  // Test 7: uploadVideo supports optional timeline fallback
  // ----------------------------------------------------
  await testAsync('uploadVideo supports asTimeline fallback for legacy feed post', async () => {
    const uploader = new FacebookUploader('test_page_100', 'test_token_secret');
    let timelineCalled = false;
    uploader.uploadTimelineVideo = async () => {
      timelineCalled = true;
      return { success: true, mode: 'TIMELINE_POST' };
    };

    const res = await uploader.uploadVideo('any_dummy_path.mp4', { title: 'Test', asTimeline: true });
    assert.strictEqual(timelineCalled, true);
    assert.strictEqual(res.mode, 'TIMELINE_POST');
  });

  // ----------------------------------------------------
  // Test 8: uploadReel formats riddle, audits packaging, and routes to publishReel
  // ----------------------------------------------------
  await testAsync('uploadReel audits packaging and routes to publishReel', async () => {
    const uploader = new FacebookUploader('test_page_100', 'test_token_secret');
    const tempVideo = path.resolve(__dirname, '../temp/test_riddle_video.mp4');
    fs.writeFileSync(tempVideo, Buffer.alloc(512, 0));

    let publishedParams = null;
    uploader.publishReel = async (_path, params) => {
      publishedParams = params;
      return {
        success: true,
        id: 'reel_riddle_123',
        url: 'https://www.facebook.com/reel/reel_riddle_123',
        reelsFeed: true,
      };
    };

    try {
      const riddleItem = {
        id: 'riddle_01',
        title: 'ऊंट की बैठक हिरन की चाल',
        questionLines: ['वह कौन सा जानवर है', 'जिसकी बैठक ऊंट जैसी होती है?'],
        tags: ['#paheliyan', '#reels'],
      };

      const res = await uploader.uploadReel(tempVideo, riddleItem);
      assert.strictEqual(res.success, true);
      assert.ok(res.titleAudit, 'Packaging audit should be attached');
      assert.ok(publishedParams.title.includes('ऊंट की बैठक'));
      assert.ok(publishedParams.description.includes('वह कौन सा जानवर है'));
    } finally {
      if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    }
  });

  // ----------------------------------------------------
  // Test 9: FacebookVideoMaker initializes audio assets
  // ----------------------------------------------------
  test('FacebookVideoMaker initializes with channel watermark and retention audio assets', () => {
    const maker = new FacebookVideoMaker();
    assert.ok(maker.outputDir);
    assert.ok(maker.tempDir);
    assert.ok(maker.audioAssets, 'Audio assets must be initialized');
    assert.ok(fs.existsSync(maker.audioAssets.bgmPath), 'BGM must exist on disk');
    assert.ok(fs.existsSync(maker.audioAssets.tickTockPath), 'Tick tock must exist on disk');
    assert.ok(fs.existsSync(maker.audioAssets.chimePath), 'Chime must exist on disk');
  });

  // ----------------------------------------------------
  // Test 10: FacebookVideoMaker SVG Frame Builder
  // ----------------------------------------------------
  test('FacebookVideoMaker SVG builder renders 1080x1920 layout with Hindi typography', () => {
    const maker = new FacebookVideoMaker();
    const mockItem = {
      id: 'test_item_01',
      topic: 'भू-राजनीति (Geopolitics)',
      hookBar: 'परीक्षा में बार बार पूछे जाने वाले सवाल',
      title: 'दुनिया में सबसे ज्यादा परमाणु हथियार किसके पास हैं?',
      questionLines: ['दुनिया में सबसे ज्यादा', 'परमाणु हथियार किस देश के पास हैं?'],
      options: [
        { letter: 'A', text: 'अमेरिका (USA)' },
        { letter: 'B', text: 'रूस (Russia)' },
        { letter: 'C', text: 'चीन (China)' },
        { letter: 'D', text: 'भारत (India)' },
      ],
      correctOption: 'B',
      answerText: 'B) रूस (Russia)',
      explanation: 'SIPRI रिपोर्ट के अनुसार रूस के पास सबसे अधिक परमाणु हथियार हैं।',
    };

    const svgQ = maker._buildSVG({ item: mockItem });
    assert.ok(svgQ.includes('width="1080" height="1920"'));
    assert.ok(svgQ.includes('भू-राजनीति'));       // topic in SVG defs comment
    assert.ok(svgQ.includes('examiqbharat'));      // new footer channel name
    assert.ok(svgQ.includes('FOLLOW'));             // new FOLLOW button (was "को Follow करें")

    const svgTimer = maker._buildSVG({ item: mockItem, timerText: '⏳ सोचो! 3.. 2.. 1.. 🎯' });
    assert.ok(svgTimer.includes('⏳ सोचो! 3.. 2.. 1.. 🎯'));

    const svgAns = maker._buildSVG({ item: mockItem, isAnswer: true });
    assert.ok(svgAns.includes('Correct Option B Highlighted'));
    assert.ok(svgAns.includes('✓'), 'Answer slide should show green checkmark on correct option');

    const svgChallenge = maker._buildSVG({ item: mockItem, isCommentChallenge: true });
    assert.ok(svgChallenge.includes('💬 Comment Your Answer (कमेंट चैलेंज)'));
    assert.ok(svgChallenge.includes('👉 अपना सही उत्तर कमेंट में बताएं! 🏆'));
    assert.ok(svgChallenge.includes('देखते हैं कितने लोग इसका सही जवाब जानते हैं!'));
    assert.ok(!svgChallenge.includes('Correct Option B Highlighted'), 'Should not highlight correct option in comment challenge mode');
    assert.ok(!svgChallenge.includes('💡 परीक्षा तथ्य'), 'Should not reveal answer/fact in comment challenge mode');
  });

  // ----------------------------------------------------
  // Test 11: uploadReel safely handles string tags and missing questionLines
  // ----------------------------------------------------
  await testAsync('uploadReel safely handles string tags and non-array metadata', async () => {
    const uploader = new FacebookUploader('test_page_100', 'test_token_secret');
    const tempVideo = path.resolve(__dirname, '../temp/test_string_tag_vid.mp4');
    fs.writeFileSync(tempVideo, Buffer.alloc(256, 0));

    let publishedParams = null;
    uploader.publishReel = async (_path, params) => {
      publishedParams = params;
      return { success: true, id: 'vid_str_123', reelsFeed: true };
    };

    try {
      // 1. With string tags
      await uploader.uploadReel(tempVideo, {
        title: 'पहेली नंबर 5',
        questionLines: ['एक ऐसा घर', 'जिसमें खिड़की न दरवाजा'],
        tags: '#desicomedy #viralreels'
      });
      assert.ok(publishedParams.description.includes('#desicomedy #viralreels'));

      // 2. Generic metadata without questionLines
      await uploader.uploadReel(tempVideo, {
        title: 'सामान्य ज्ञान टेस्ट',
        caption: 'आज का महत्वपूर्ण सवाल #reels'
      });
      assert.strictEqual(publishedParams.title, 'सामान्य ज्ञान टेस्ट');
      assert.strictEqual(publishedParams.description, 'आज का महत्वपूर्ण सवाल #reels');
    } finally {
      if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    }
  });

  // ----------------------------------------------------
  // Test 12: publishReel polls until ready status
  // ----------------------------------------------------
  await testAsync('publishReel polls status from processing to ready', async () => {
    const uploader = new FacebookUploader('test_page_100', 'test_token_secret');
    const tempVideo = path.resolve(__dirname, '../temp/test_poll_vid.mp4');
    fs.writeFileSync(tempVideo, Buffer.alloc(256, 0));

    const originalPost = axios.post;
    const originalGet = axios.get;
    let getAttempts = 0;

    try {
      axios.post = async (url) => {
        if (url.includes('/video_reels')) {
          return { status: 200, data: { video_id: 'vid_poll_789' } };
        }
        if (url.includes('rupload.facebook.com')) {
          return { status: 200, data: { success: true } };
        }
      };

      axios.get = async () => {
        getAttempts++;
        if (getAttempts === 1) {
          return { status: 200, data: { status: { video_status: 'processing' } } };
        }
        return { status: 200, data: { status: { video_status: 'ready' } } };
      };

      const res = await uploader.publishReel(tempVideo, { title: 'Poll Test' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, 'ready');
      assert.strictEqual(getAttempts, 2, 'Should poll twice to reach ready');
    } finally {
      axios.post = originalPost;
      axios.get = originalGet;
      if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    }
  });

  // ----------------------------------------------------
  // Test 13: createReel defaults to Comment Challenge CTA audio & frame rendering
  // ----------------------------------------------------
  await testAsync('createReel defaults to Comment Challenge CTA narration without revealing answer', async () => {
    const maker = new FacebookVideoMaker();
    const mockItem = {
      id: 'test_challenge_item',
      topic: 'भू-राजनीति (Geopolitics)',
      hookBar: 'परीक्षा में बार बार पूछे जाने वाले सवाल',
      title: 'दुनिया में सबसे ज्यादा परमाणु हथियार किसके पास हैं?',
      question: 'दुनिया में सबसे ज्यादा परमाणु हथियार किस देश के पास हैं?',
      questionLines: ['दुनिया में सबसे ज्यादा', 'परमाणु हथियार किस देश के पास हैं?'],
      options: [
        { letter: 'A', text: 'अमेरिका (USA)' },
        { letter: 'B', text: 'रूस (Russia)' },
        { letter: 'C', text: 'चीन (China)' },
        { letter: 'D', text: 'भारत (India)' },
      ],
      correctOption: 'B',
      answerText: 'B) रूस (Russia)',
      voiceQuestion: 'दुनिया में सबसे ज्यादा परमाणु हथियार किस देश के पास हैं?',
      voiceTimer: 'सोचने के लिए 3 सेकंड!',
      voiceAnswer: 'सही जवाब है ऑप्शन B रूस!',
    };

    const audioCalls = [];
    maker._getAudio = async (text, outPath) => {
      audioCalls.push({ text, outPath });
      fs.writeFileSync(outPath, Buffer.alloc(512, 0));
      return outPath;
    };

    const ffmpegModule = require('../utils/ffmpeg');
    const origRunFFmpeg = ffmpegModule.runFFmpeg;
    const origGetMediaDuration = ffmpegModule.getMediaDuration;

    ffmpegModule.getMediaDuration = async () => 3.0;
    ffmpegModule.runFFmpeg = async (args) => {
      const lastArg = args[args.length - 1];
      if (lastArg && typeof lastArg === 'string' && lastArg.endsWith('.mp4')) {
        fs.writeFileSync(lastArg, Buffer.alloc(100, 0));
      }
    };

    try {
      // 1. Default invocation (commentChallenge: true)
      const reelPath = await maker.createReel(mockItem);
      assert.ok(reelPath.endsWith('.mp4'));
      assert.strictEqual(audioCalls.length, 3);
      assert.strictEqual(
        audioCalls[2].text,
        'अब इस सवाल का सही जवाब आप कमेंट बॉक्स में बताइए! देखते हैं कितने लोग सही उत्तर देते हैं! और रोज़ाना नए GK टेस्ट के लिए Exam IQ Bharat को Follow करें!'
      );
      if (fs.existsSync(reelPath)) fs.unlinkSync(reelPath);

      // 2. Opt-out invocation (commentChallenge: false)
      audioCalls.length = 0;
      const optOutReelPath = await maker.createReel(mockItem, { commentChallenge: false });
      assert.ok(optOutReelPath.endsWith('.mp4'));
      assert.strictEqual(audioCalls.length, 3);
      assert.strictEqual(audioCalls[2].text, 'सही जवाब है ऑप्शन B रूस!');
      if (fs.existsSync(optOutReelPath)) fs.unlinkSync(optOutReelPath);
    } finally {
      ffmpegModule.runFFmpeg = origRunFFmpeg;
      ffmpegModule.getMediaDuration = origGetMediaDuration;
    }
  });


  // ----------------------------------------------------
  // Test 14: ContentVault has 120+ unique, balanced questions
  // ----------------------------------------------------
  test('ContentVault contains 100+ unique questions evenly balanced across A/B/C/D', () => {
    const { EXAM_GK_QUESTIONS } = require('../facebook/content-vault');
    assert.ok(EXAM_GK_QUESTIONS.length >= 100, `Expected >= 100 questions, found ${EXAM_GK_QUESTIONS.length}`);

    const ids = new Set();
    const dist = { A: 0, B: 0, C: 0, D: 0 };
    for (const q of EXAM_GK_QUESTIONS) {
      assert.ok(!ids.has(q.id), `Duplicate ID found: ${q.id}`);
      ids.add(q.id);
      assert.ok(['A', 'B', 'C', 'D'].includes(q.correctOption), `Invalid correctOption on ${q.id}`);
      dist[q.correctOption]++;
      assert.strictEqual(q.options.length, 4, `Expected 4 options on ${q.id}`);
    }
    assert.ok(dist.A >= 20 && dist.B >= 20 && dist.C >= 20 && dist.D >= 20, `Unbalanced correct options: ${JSON.stringify(dist)}`);
  });

  // ----------------------------------------------------
  // Test 15: ContentVault 30-day anti-duplicate guard
  // ----------------------------------------------------
  await testAsync('ContentVault 30-day anti-duplicate guard blocks recent repeats', async () => {
    const { ContentVault, EXAM_GK_QUESTIONS } = require('../facebook/content-vault');
    const vault = new ContentVault();
    const tempHistory = path.resolve(__dirname, '../temp/test_history_guard.json');
    vault.historyFile = tempHistory;

    const nowIso = new Date().toISOString();
    const oldIso = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

    // Mark all except the last 2 questions as uploaded recently, except q[0] which was 35 days ago
    const uploads = EXAM_GK_QUESTIONS.slice(1, -2).map(q => ({ id: q.id, uploadedAt: nowIso }));
    uploads.push({ id: EXAM_GK_QUESTIONS[0].id, uploadedAt: oldIso });

    fs.writeFileSync(tempHistory, JSON.stringify({ uploadedIds: uploads.map(u => u.id), uploads }), 'utf8');

    try {
      const batch = await vault.getBatchQuestions(3);
      assert.strictEqual(batch.length, 3);
      const pickedIds = new Set(batch.map(b => b.id));
      // Must pick the expired (>30d) question and the 2 never-uploaded questions
      assert.ok(pickedIds.has(EXAM_GK_QUESTIONS[0].id), 'Should allow question uploaded >30 days ago');
      assert.ok(pickedIds.has(EXAM_GK_QUESTIONS[EXAM_GK_QUESTIONS.length - 1].id), 'Should pick never-uploaded question');
      assert.ok(pickedIds.has(EXAM_GK_QUESTIONS[EXAM_GK_QUESTIONS.length - 2].id), 'Should pick never-uploaded question');
    } finally {
      if (fs.existsSync(tempHistory)) fs.unlinkSync(tempHistory);
    }
  });

  // ----------------------------------------------------
  // Test 16: Reels Bottom Safe Zone check (footer sits above bottom 350px)
  // ----------------------------------------------------
  test('FacebookVideoMaker footer banner stays in Reels safe zone above y=1560', () => {
    const maker = new FacebookVideoMaker();
    const { EXAM_GK_QUESTIONS } = require('../facebook/content-vault');
    const svg = maker._buildSVG({ item: EXAM_GK_QUESTIONS[0], isCommentChallenge: true });
    // Pink brand footer box at x="60" y="1430" width="510" height="105"
    const match = svg.match(/<rect x="60" y="(\d+)" width="510" height="(\d+)"/);
    assert.ok(match, 'Footer banner rect must exist');
    const y = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    assert.ok(y + h <= 1560, `Footer bottom edge (${y + h}) encroaches into Reels 360px bottom UI zone!`);
  });

  // ----------------------------------------------------
  // Test 17: Export Deliverer buildReelMetadata formats options & keeps answerKey out of description
  // ----------------------------------------------------
  test('buildReelMetadata builds description, tags, pinnedComment and separates answerKey', () => {
    const { buildReelMetadata } = require('../facebook/export-deliverer');
    const meta = buildReelMetadata({
      id: 'geo_test_1',
      title: 'टेस्ट सवाल',
      topic: 'भूगोल (Geography)',
      question: 'भारत की सबसे लंबी नदी कौन सी है?',
      options: [
        { letter: 'A', text: 'गंगा' },
        { letter: 'B', text: 'यमुना' },
        { letter: 'C', text: 'गोदावरी' },
        { letter: 'D', text: 'नर्मदा' },
      ],
      correctOption: 'A',
      answerText: 'A) गंगा',
      tags: ['#ExamIQ', '#GK'],
    });
    assert.ok(meta.title.includes('Exam IQ Bharat'));
    assert.ok(meta.description.includes('Q. भारत की सबसे लंबी नदी कौन सी है?'));
    assert.ok(meta.description.includes('A) गंगा'));
    assert.ok(meta.description.includes('#ReelsViral'));
    assert.ok(meta.pinnedComment.includes('कमेंट'));
    assert.strictEqual(meta.answerKey, 'A) गंगा');
  });

  // ----------------------------------------------------
  // Test 18: createExportBundle creates numbered MP4s, captions.txt, manifest & clears stale files
  // ----------------------------------------------------
  test('createExportBundle packages MP4s, captions.txt, schedule_manifest.json and cleans stale files', () => {
    const { createExportBundle, buildReelMetadata } = require('../facebook/export-deliverer');
    const tempBase = path.resolve(__dirname, '../temp/test_export_bundle');
    const dummySrc = path.resolve(__dirname, '../temp/test_export_src.mp4');
    fs.mkdirSync(tempBase, { recursive: true });
    fs.writeFileSync(path.join(tempBase, 'stale_old_reel.mp4'), 'stale', 'utf8');
    fs.writeFileSync(dummySrc, Buffer.from('00000018ftypmp42', 'utf8'));

    try {
      const item = {
        id: 'stat_isro_03',
        category: 'static_gk',
        topic: 'भारतीय अंतरिक्ष',
        title: 'ISRO मुख्यालय',
        question: 'ISRO का मुख्यालय कहाँ है?',
        options: [
          { letter: 'A', text: 'दिल्ली' },
          { letter: 'B', text: 'बेंगलुरु' },
          { letter: 'C', text: 'मुंबई' },
          { letter: 'D', text: 'चेन्नई' },
        ],
        correctOption: 'B',
        answerText: 'B) बेंगलुरु',
      };
      const bundle = createExportBundle(
        [{ item, videoPath: dummySrc, metadata: buildReelMetadata(item) }],
        { exportDir: tempBase, scheduleStartDate: '2026-11-12T10:00:00Z' }
      );

      assert.strictEqual(fs.existsSync(path.join(tempBase, 'stale_old_reel.mp4')), false, 'Stale file must be removed');
      assert.strictEqual(bundle.items.length, 1);
      assert.strictEqual(bundle.items[0].filename, '01_stat_isro_03.mp4');
      assert.ok(fs.existsSync(bundle.items[0].exportedVideoPath));
      assert.ok(fs.existsSync(bundle.captionsPath));
      assert.ok(fs.existsSync(bundle.manifestPath));

      const captionsTxt = fs.readFileSync(bundle.captionsPath, 'utf8');
      assert.ok(captionsTxt.includes('01_stat_isro_03.mp4'));
      assert.ok(captionsTxt.includes('CREATOR ANSWER KEY'));
      assert.ok(captionsTxt.includes('08:30 PM IST'));

      const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8'));
      assert.strictEqual(manifest.totalReels, 1);
      assert.strictEqual(manifest.reels[0].id, 'stat_isro_03');
    } finally {
      fs.rmSync(tempBase, { recursive: true, force: true });
      if (fs.existsSync(dummySrc)) fs.unlinkSync(dummySrc);
    }
  });

  // ----------------------------------------------------
  // Test 19: sendToTelegram skips unconfigured, sends mocked videos + redacts secrets on error
  // ----------------------------------------------------
  await testAsync('sendToTelegram skips when unconfigured, delivers mocked batch, and redacts token on errors', async () => {
    const { sendToTelegram, buildReelMetadata } = require('../facebook/export-deliverer');
    const prevToken = process.env.TELEGRAM_BOT_TOKEN;
    const prevChat = process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    const dummyMp4 = path.resolve(__dirname, '../temp/test_tg_reel.mp4');
    fs.writeFileSync(dummyMp4, Buffer.from('00000018ftypmp42', 'utf8'));

    try {
      const skipped = await sendToTelegram([]);
      assert.strictEqual(skipped.skipped, true);
      assert.strictEqual(skipped.sent, false);

      const postCalls = [];
      const mockHttp = {
        post: async (url, body) => {
          postCalls.push({ url, body });
          return { data: { ok: true } };
        },
      };

      const longItem = {
        id: 'tg_01',
        title: 'टेस्ट',
        topic: 'GK',
        question: 'लम्बा सवाल '.repeat(120),
        options: [{ letter: 'A', text: '1' }, { letter: 'B', text: '2' }, { letter: 'C', text: '3' }, { letter: 'D', text: '4' }],
        answerText: 'A) 1',
      };
      const meta = buildReelMetadata(longItem);
      const sentRes = await sendToTelegram(
        [{ item: longItem, filename: '01_tg_01.mp4', exportedVideoPath: dummyMp4, metadata: meta }],
        { botToken: 'SECRET_BOT_TOKEN_123', chatId: '999999', httpClient: mockHttp, delayMs: 0 }
      );
      assert.strictEqual(sentRes.sent, true);
      assert.strictEqual(sentRes.sentCount, 1);
      // sendVideo + fallback sendMessage (>1024 chars) + batch summary sendMessage
      assert.strictEqual(postCalls.length, 3);
      assert.ok(postCalls[0].url.endsWith('/sendVideo'));
      assert.ok(postCalls[1].url.endsWith('/sendMessage'));
      assert.ok(postCalls[2].url.endsWith('/sendMessage'));

      // Verify token is redacted from recorded error messages on failure
      const failingHttp = {
        post: async () => {
          throw new Error('Request failed for https://api.telegram.org/botSECRET_BOT_TOKEN_123/sendVideo');
        },
      };
      const errRes = await sendToTelegram(
        [{ item: longItem, filename: '01_tg_01.mp4', exportedVideoPath: dummyMp4, metadata: meta }],
        { botToken: 'SECRET_BOT_TOKEN_123', chatId: '999999', httpClient: failingHttp, delayMs: 0 }
      );
      assert.strictEqual(errRes.sentCount, 0);
      assert.strictEqual(errRes.errors.length, 1);
      assert.strictEqual(errRes.errors[0].error.includes('SECRET_BOT_TOKEN_123'), false, 'Bot token must be redacted from error strings');
      assert.ok(errRes.errors[0].error.includes('[REDACTED_BOT_TOKEN]'));
    } finally {
      if (prevToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = prevToken;
      if (prevChat !== undefined) process.env.TELEGRAM_CHAT_ID = prevChat;
      if (fs.existsSync(dummyMp4)) fs.unlinkSync(dummyMp4);
    }
  });

  // ----------------------------------------------------
  // Test 20: fb-runner Export Mode runs without FB_PAGE_ACCESS_TOKEN and records history
  // ----------------------------------------------------
  await testAsync('fb-runner default export mode works without Meta token and writes export bundle + history', async () => {
    const { resolveDeliveryMode, runFacebookReelsAutomation } = require('../facebook/fb-runner');
    const { ContentVault } = require('../facebook/content-vault');

    assert.strictEqual(resolveDeliveryMode([], {}), 'export');
    assert.strictEqual(resolveDeliveryMode([], { ZERNIO_API_KEY: 'z_live_123' }), 'zernio');
    assert.strictEqual(resolveDeliveryMode(['--publish-zernio'], {}), 'zernio');
    assert.strictEqual(resolveDeliveryMode(['--publish-api'], {}), 'publish_api');
    assert.strictEqual(resolveDeliveryMode(['--export-only'], { ZERNIO_API_KEY: 'z_live_123', FB_DELIVERY_MODE: 'zernio' }), 'export');
    assert.strictEqual(resolveDeliveryMode([], { FB_DELIVERY_MODE: 'publish_api' }), 'publish_api');

    const prevToken = process.env.FB_PAGE_ACCESS_TOKEN;
    const prevPage = process.env.FB_PAGE_ID;
    delete process.env.FB_PAGE_ACCESS_TOKEN;
    delete process.env.FB_PAGE_ID;

    const tempExportDir = path.resolve(__dirname, '../temp/test_runner_export');
    const tempHistoryFile = path.resolve(__dirname, '../temp/test_runner_history.json');
    const fakeVideoOut = path.resolve(__dirname, '../temp/test_runner_fake_reel.mp4');

    const vault = new ContentVault();
    vault.historyFile = tempHistoryFile;
    const mockVideoMaker = {
      createReel: async () => {
        fs.writeFileSync(fakeVideoOut, Buffer.from('00000018ftypmp42', 'utf8'));
        return fakeVideoOut;
      },
    };

    try {
      const res = await runFacebookReelsAutomation({
        args: ['--count', '2'],
        deliveryMode: 'export',
        exportDir: tempExportDir,
        sendTelegram: false,
        vault,
        videoMaker: mockVideoMaker,
      });

      assert.strictEqual(res.deliveryMode, 'export');
      assert.strictEqual(res.results.length, 2);
      assert.ok(res.results.every(r => r.status === 'EXPORTED'));
      assert.ok(fs.existsSync(res.exportBundle.captionsPath));
      assert.ok(fs.existsSync(res.exportBundle.manifestPath));

      const history = JSON.parse(fs.readFileSync(tempHistoryFile, 'utf8'));
      assert.strictEqual(history.uploads.length, 2);
      assert.strictEqual(history.uploads[0].fbVideoId, null);
      assert.strictEqual(history.uploads[0].deliveryMode, 'EXPORT_READY');
    } finally {
      if (prevToken !== undefined) process.env.FB_PAGE_ACCESS_TOKEN = prevToken;
      if (prevPage !== undefined) process.env.FB_PAGE_ID = prevPage;
      fs.rmSync(tempExportDir, { recursive: true, force: true });
      if (fs.existsSync(tempHistoryFile)) fs.unlinkSync(tempHistoryFile);
      if (fs.existsSync(fakeVideoOut)) fs.unlinkSync(fakeVideoOut);
    }
  });

  // ----------------------------------------------------
  // Test 21: ZernioUploader auto-resolves FB account, uploads presigned MP4, publishes Reel & redacts keys
  // ----------------------------------------------------
  await testAsync('ZernioUploader resolves Facebook Page, presigns MP4, publishes contentType=reel & extracts FB Reel ID', async () => {
    const { ZernioUploader, extractFacebookVideoId } = require('../facebook/zernio-uploader');
    assert.strictEqual(extractFacebookVideoId('https://www.facebook.com/reel/9876543210123/'), '9876543210123');
    assert.strictEqual(extractFacebookVideoId('https://zernio.com/posts/abc'), null);

    const calls = [];
    const mockHttp = {
      get: async (url, cfg) => {
        calls.push({ method: 'GET', url, cfg });
        return {
          data: {
            accounts: [
              { _id: 'acc_ig_1', platform: 'instagram', status: 'active' },
              { _id: 'acc_fb_exam', platform: 'facebook', displayName: 'Exam IQ Bharat', status: 'active' },
            ],
          },
        };
      },
      post: async (url, body, cfg) => {
        calls.push({ method: 'POST', url, body, cfg });
        if (url.endsWith('/media/presign')) {
          return {
            data: {
              uploadUrl: 'https://storage.zernio.com/presign/reel1.mp4',
              publicUrl: 'https://storage.zernio.com/public/reel1.mp4',
            },
          };
        }
        return {
          data: {
            post: {
              _id: 'zernio_post_77',
              status: 'published',
              platforms: [
                {
                  platform: 'facebook',
                  status: 'published',
                  platformPostUrl: 'https://www.facebook.com/reel/112233445566778/',
                },
              ],
            },
          },
        };
      },
      put: async (url, data, cfg) => {
        calls.push({ method: 'PUT', url, byteLength: data.length, cfg });
        return { status: 200 };
      },
    };

    const dummyMp4 = path.resolve(__dirname, '../temp/test_zernio_reel.mp4');
    fs.writeFileSync(dummyMp4, Buffer.from('00000018ftypmp42', 'utf8'));

    try {
      const uploader = new ZernioUploader({ apiKey: 'SECRET_ZERNIO_KEY', httpClient: mockHttp });
      const res = await uploader.publishReel(dummyMp4, {
        title: 'ISRO GK Quiz',
        description: 'Q. ISRO मुख्यालय?',
        firstComment: 'कमेंट में जवाब दें!',
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.deliveryMode, 'ZERNIO_API');
      assert.strictEqual(res.fbVideoId, '112233445566778');
      assert.strictEqual(res.zernioPostId, 'zernio_post_77');
      assert.strictEqual(res.url, 'https://www.facebook.com/reel/112233445566778/');
      assert.strictEqual(calls.length, 4);
      assert.strictEqual(calls[0].method, 'GET');
      assert.strictEqual(calls[1].method, 'POST');
      assert.strictEqual(calls[2].method, 'PUT');
      assert.strictEqual(calls[3].method, 'POST');
      assert.strictEqual(calls[3].body.platforms[0].accountId, 'acc_fb_exam');
      assert.strictEqual(calls[3].body.platforms[0].platformSpecificData.contentType, 'reel');
      assert.strictEqual(calls[3].body.platforms[0].platformSpecificData.firstComment, 'कमेंट में जवाब दें!');

      // Verify secret API key redaction when Zernio fails
      const failingHttp = {
        get: async () => {
          throw new Error('Unauthorized with key SECRET_ZERNIO_KEY');
        },
      };
      const failingUploader = new ZernioUploader({ apiKey: 'SECRET_ZERNIO_KEY', httpClient: failingHttp });
      let caughtMsg = '';
      try {
        await failingUploader.resolveFacebookAccountId();
      } catch (e) {
        caughtMsg = e.message;
      }
      assert.strictEqual(caughtMsg.includes('SECRET_ZERNIO_KEY'), false, 'Zernio API key must be redacted');
      assert.ok(caughtMsg.includes('[REDACTED_ZERNIO_KEY]'));
    } finally {
      if (fs.existsSync(dummyMp4)) fs.unlinkSync(dummyMp4);
    }
  });

  // ----------------------------------------------------
  // Test 22: fb-runner automatic zernio mode publishes end-to-end and keeps analytics safe
  // ----------------------------------------------------
  await testAsync('fb-runner zernio mode publishes automatic Reel and stores ZERNIO_API history safely', async () => {
    const { runFacebookReelsAutomation } = require('../facebook/fb-runner');
    const { ContentVault } = require('../facebook/content-vault');

    const tempHistoryFile = path.resolve(__dirname, '../temp/test_zernio_history.json');
    const fakeVideoOut = path.resolve(__dirname, '../temp/test_zernio_runner.mp4');
    const vault = new ContentVault();
    vault.historyFile = tempHistoryFile;

    const mockVideoMaker = {
      createReel: async () => {
        fs.writeFileSync(fakeVideoOut, Buffer.from('00000018ftypmp42', 'utf8'));
        return fakeVideoOut;
      },
    };
    const publishedPayloads = [];
    const mockZernioUploader = {
      publishReel: async (videoPath, opts) => {
        publishedPayloads.push({ videoPath, opts });
        return {
          success: true,
          id: 'z_only_id',
          fbVideoId: null,
          zernioPostId: 'z_only_id',
          url: 'https://zernio.com/posts/z_only_id',
          deliveryMode: 'ZERNIO_API',
        };
      },
    };

    try {
      const res = await runFacebookReelsAutomation({
        args: ['--count', '1'],
        deliveryMode: 'zernio',
        vault,
        videoMaker: mockVideoMaker,
        zernioUploader: mockZernioUploader,
      });

      assert.strictEqual(res.deliveryMode, 'zernio');
      assert.strictEqual(res.results.length, 1);
      assert.strictEqual(res.results[0].status, 'SUCCESS');
      assert.strictEqual(publishedPayloads.length, 1);
      assert.ok(publishedPayloads[0].opts.firstComment.includes('कमेंट'));

      const history = JSON.parse(fs.readFileSync(tempHistoryFile, 'utf8'));
      assert.strictEqual(history.uploads[0].deliveryMode, 'ZERNIO_API');
      assert.strictEqual(history.uploads[0].zernioPostId, 'z_only_id');
      assert.strictEqual(history.uploads[0].fbVideoId, null, 'Non-numeric Zernio ID must not pollute fbVideoId');
    } finally {
      if (fs.existsSync(tempHistoryFile)) fs.unlinkSync(tempHistoryFile);
      if (fs.existsSync(fakeVideoOut)) fs.unlinkSync(fakeVideoOut);
    }
  });

  // ----------------------------------------------------
  // Test 23: ZernioUploader polls async 'publishing' posts for final URL and surfaces async failures
  // ----------------------------------------------------
  await testAsync('ZernioUploader polls GET /v1/posts/{id} for async URL and throws on async failure', async () => {
    const { ZernioUploader } = require('../facebook/zernio-uploader');
    const dummyMp4 = path.resolve(__dirname, '../temp/test_zernio_async.mp4');
    fs.writeFileSync(dummyMp4, Buffer.from('00000018ftypmp42', 'utf8'));

    let pollCount = 0;
    const pollHttp = {
      get: async (url) => {
        if (url.endsWith('/accounts')) {
          return { data: { accounts: [{ _id: 'acc_fb_1', platform: 'facebook', status: 'active' }] } };
        }
        if (url.endsWith('/posts/async_post_1')) {
          pollCount += 1;
          if (pollCount === 1) {
            return { data: { post: { _id: 'async_post_1', status: 'publishing', platforms: [{ platform: 'facebook', status: 'publishing' }] } } };
          }
          return {
            data: {
              post: {
                _id: 'async_post_1',
                status: 'published',
                platforms: [{ platform: 'facebook', status: 'published', platformPostUrl: 'https://www.facebook.com/reel/55667788990011/' }],
              },
            },
          };
        }
        if (url.endsWith('/posts/async_fail_1')) {
          return {
            data: {
              post: {
                _id: 'async_fail_1',
                status: 'failed',
                platforms: [{ platform: 'facebook', status: 'failed', errorMessage: 'Page token expired' }],
              },
            },
          };
        }
        throw new Error(`Unexpected GET ${url}`);
      },
      post: async (url) => {
        if (url.endsWith('/media/presign')) {
          return { data: { uploadUrl: 'https://storage.zernio.com/up.mp4', publicUrl: 'https://storage.zernio.com/pub.mp4' } };
        }
        return { data: { post: { _id: 'async_post_1', status: 'publishing', platforms: [{ platform: 'facebook', status: 'publishing' }] } } };
      },
      put: async () => ({ status: 200 }),
    };

    try {
      const uploader = new ZernioUploader({
        apiKey: 'SECRET_POLL_KEY',
        httpClient: pollHttp,
        pollIntervalMs: 0,
        maxPolls: 5,
      });
      const res = await uploader.publishReel(dummyMp4, { title: 'Async Reel', description: 'Desc' });
      assert.strictEqual(pollCount, 2);
      assert.strictEqual(res.fbVideoId, '55667788990011');
      assert.strictEqual(res.url, 'https://www.facebook.com/reel/55667788990011/');
      assert.strictEqual(res.status, 'published');

      let failMsg = '';
      try {
        await uploader.waitForPostCompletion('async_fail_1', { _id: 'async_fail_1', status: 'publishing' });
      } catch (err) {
        failMsg = err.message;
      }
      assert.ok(failMsg.includes('Page token expired'), 'Async Facebook failure reason must surface cleanly');
    } finally {
      if (fs.existsSync(dummyMp4)) fs.unlinkSync(dummyMp4);
    }
  });

  // ----------------------------------------------------
  // Test 24: ZernioUploader auto-recovers from async Facebook API parameter rejection without re-uploading MP4
  // ----------------------------------------------------
  await testAsync('ZernioUploader auto-retries async Facebook parameter rejection across fallback strategies', async () => {
    const { ZernioUploader } = require('../facebook/zernio-uploader');
    const dummyMp4 = path.resolve(__dirname, '../temp/test_zernio_fallback.mp4');
    fs.writeFileSync(dummyMp4, Buffer.from('00000018ftypmp42', 'utf8'));

    let putCalls = 0;
    const postedPayloads = [];
    const fallbackHttp = {
      get: async (url) => {
        if (url.endsWith('/accounts')) {
          return { data: { accounts: [{ _id: 'acc_fb_1', platform: 'facebook', status: 'active' }] } };
        }
        if (url.endsWith('/posts/try_1') || url.endsWith('/posts/try_2')) {
          return {
            data: {
              post: {
                _id: url.split('/').pop(),
                status: 'failed',
                platforms: [{ platform: 'facebook', status: 'failed', errorMessage: 'Facebook: Facebook API rejected the request parameters.' }],
              },
            },
          };
        }
        if (url.endsWith('/posts/try_3')) {
          return {
            data: {
              post: {
                _id: 'try_3',
                status: 'published',
                platforms: [{ platform: 'facebook', status: 'published', platformPostUrl: 'https://www.facebook.com/reel/778899001122/' }],
              },
            },
          };
        }
        throw new Error(`Unexpected GET ${url}`);
      },
      post: async (url, body) => {
        if (url.endsWith('/media/presign')) {
          return { data: { uploadUrl: 'https://storage.zernio.com/up2.mp4', publicUrl: 'https://storage.zernio.com/pub2.mp4' } };
        }
        postedPayloads.push(body);
        const attemptId = `try_${postedPayloads.length}`;
        return { data: { post: { _id: attemptId, status: 'publishing', platforms: [{ platform: 'facebook', status: 'publishing' }] } } };
      },
      put: async () => {
        putCalls += 1;
        return { status: 200 };
      },
    };

    try {
      const uploader = new ZernioUploader({
        apiKey: 'SECRET_FALLBACK_KEY',
        httpClient: fallbackHttp,
        pollIntervalMs: 0,
        maxPolls: 2,
      });
      const res = await uploader.publishReel(dummyMp4, {
        title: 'Ignored Reel Title',
        description: 'Main Reel caption',
        firstComment: 'Comment challenge!',
      });

      assert.strictEqual(putCalls, 1, 'MP4 binary must only be uploaded once across retries');
      assert.strictEqual(postedPayloads.length, 3);
      assert.strictEqual(postedPayloads[0].platforms[0].platformSpecificData.title, undefined, 'Must not send unsupported title on Facebook Reel');
      assert.strictEqual(postedPayloads[0].platforms[0].platformSpecificData.firstComment, 'Comment challenge!');
      assert.deepStrictEqual(postedPayloads[1].platforms[0].platformSpecificData, { contentType: 'reel' });
      assert.strictEqual(postedPayloads[2].platforms[0].platformSpecificData, undefined);
      assert.strictEqual(res.fbVideoId, '778899001122');
      assert.strictEqual(res.url, 'https://www.facebook.com/reel/778899001122/');
    } finally {
      if (fs.existsSync(dummyMp4)) fs.unlinkSync(dummyMp4);
    }
  });

  // ----------------------------------------------------
  // Test 25: ZernioUploader auto-resolves Instagram account and publishes Instagram Reel
  // ----------------------------------------------------
  await testAsync('ZernioUploader resolves Instagram account and publishes Instagram Reel with shareToFeed', async () => {
    const { ZernioUploader, extractInstagramReelId } = require('../facebook/zernio-uploader');

    assert.strictEqual(extractInstagramReelId('https://www.instagram.com/reel/C8abcXYZ_12/'), 'C8abcXYZ_12');
    assert.strictEqual(extractInstagramReelId('https://www.instagram.com/p/D9test123/'), 'D9test123');
    assert.strictEqual(extractInstagramReelId('invalid_url'), null);

    const calls = [];
    const mockHttp = {
      get: async (url) => {
        calls.push({ method: 'GET', url });
        if (url.endsWith('/accounts')) {
          return {
            data: {
              accounts: [
                { _id: 'acc_fb_1', platform: 'facebook', displayName: 'FB Page' },
                { _id: 'acc_ig_1', platform: 'instagram', username: 'examiqbharat', status: 'active' },
              ],
            },
          };
        }
        return { data: { status: 'published' } };
      },
      post: async (url, body) => {
        calls.push({ method: 'POST', url, body });
        if (url.endsWith('/media/presign')) {
          return {
            data: {
              uploadUrl: 'https://storage.zernio.com/presign/reel_ig.mp4',
              publicUrl: 'https://storage.zernio.com/public/reel_ig.mp4',
            },
          };
        }
        return {
          data: {
            post: {
              _id: 'zernio_ig_post_88',
              status: 'published',
              platforms: [
                {
                  platform: 'instagram',
                  status: 'published',
                  platformPostUrl: 'https://www.instagram.com/reel/C8XYZtest99/',
                },
              ],
            },
          },
        };
      },
      put: async (url, data) => {
        calls.push({ method: 'PUT', url, byteLength: data.length });
        return { status: 200 };
      },
    };

    const dummyMp4 = path.resolve(__dirname, '../temp/test_zernio_ig.mp4');
    fs.writeFileSync(dummyMp4, Buffer.from('00000018ftypmp42', 'utf8'));

    try {
      const uploader = new ZernioUploader({ apiKey: 'KEY_TEST', httpClient: mockHttp });
      const res = await uploader.publishInstagramReel(dummyMp4, {
        title: 'Hindi GK Quiz',
        description: 'Q. भारत की राजधानी?',
        firstComment: 'Comment answer!',
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.platform, 'instagram');
      assert.strictEqual(res.igMediaId, 'C8XYZtest99');
      assert.strictEqual(res.url, 'https://www.instagram.com/reel/C8XYZtest99/');
      assert.strictEqual(calls.length, 4);
      assert.strictEqual(calls[3].body.platforms[0].platform, 'instagram');
      assert.strictEqual(calls[3].body.platforms[0].accountId, 'acc_ig_1');
      assert.strictEqual(calls[3].body.platforms[0].platformSpecificData.shareToFeed, true);
      assert.strictEqual(calls[3].body.platforms[0].platformSpecificData.firstComment, 'Comment answer!');
    } finally {
      if (fs.existsSync(dummyMp4)) fs.unlinkSync(dummyMp4);
    }
  });

  // ----------------------------------------------------
  // Test 26: ZernioUploader publishMultiReel publishes to both Facebook and Instagram
  // ----------------------------------------------------
  await testAsync('ZernioUploader publishMultiReel publishes to both Facebook & Instagram in 1 pass', async () => {
    const { ZernioUploader } = require('../facebook/zernio-uploader');
    const calls = [];
    const mockHttp = {
      get: async (url) => {
        calls.push({ method: 'GET', url });
        if (url.endsWith('/accounts')) {
          return {
            data: {
              accounts: [
                { _id: 'acc_fb_multi', platform: 'facebook', displayName: 'FB Page' },
                { _id: 'acc_ig_multi', platform: 'instagram', username: 'ig_page' },
              ],
            },
          };
        }
        return { data: { status: 'published' } };
      },
      post: async (url, body) => {
        calls.push({ method: 'POST', url, body });
        if (url.endsWith('/media/presign')) {
          return {
            data: {
              uploadUrl: 'https://storage.zernio.com/presign/reel_multi.mp4',
              publicUrl: 'https://storage.zernio.com/public/reel_multi.mp4',
            },
          };
        }
        return {
          data: {
            post: {
              _id: 'zernio_multi_100',
              status: 'published',
              platforms: [
                {
                  platform: 'facebook',
                  status: 'published',
                  platformPostUrl: 'https://www.facebook.com/reel/998877665544/',
                },
                {
                  platform: 'instagram',
                  status: 'published',
                  platformPostUrl: 'https://www.instagram.com/reel/C9multiPost123/',
                },
              ],
            },
          },
        };
      },
      put: async () => ({ status: 200 }),
    };

    const dummyMp4 = path.resolve(__dirname, '../temp/test_zernio_multi.mp4');
    fs.writeFileSync(dummyMp4, Buffer.from('00000018ftypmp42', 'utf8'));

    try {
      const uploader = new ZernioUploader({ apiKey: 'KEY_TEST', httpClient: mockHttp });
      const res = await uploader.publishMultiReel(dummyMp4, {
        title: 'Polity Quiz',
        description: 'Constitution GK',
        firstComment: 'Score?',
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.facebook.id, '998877665544');
      assert.strictEqual(res.facebook.url, 'https://www.facebook.com/reel/998877665544/');
      assert.strictEqual(res.instagram.id, 'C9multiPost123');
      assert.strictEqual(res.instagram.url, 'https://www.instagram.com/reel/C9multiPost123/');
      const postCall = calls.find(c => c.method === 'POST' && c.url.endsWith('/posts'));
      assert.ok(postCall, 'Must call POST /posts');
      assert.strictEqual(postCall.body.platforms.length, 2, 'Must submit both FB and IG platforms');
    } finally {
      if (fs.existsSync(dummyMp4)) fs.unlinkSync(dummyMp4);
    }
  });

  // ----------------------------------------------------
  // Test 27: resolveSocialTarget parses CLI flags and env correctly
  // ----------------------------------------------------
  await testAsync('resolveSocialTarget parses CLI flags and env safely', async () => {
    const { resolveSocialTarget } = require('../facebook/fb-runner');

    assert.strictEqual(resolveSocialTarget(['--instagram']), 'instagram');
    assert.strictEqual(resolveSocialTarget(['--facebook']), 'facebook');
    assert.strictEqual(resolveSocialTarget(['--both']), 'both');
    assert.strictEqual(resolveSocialTarget(['--target', 'instagram']), 'instagram');
    assert.strictEqual(resolveSocialTarget([], { SOCIAL_DELIVERY_TARGET: 'instagram' }), 'instagram');
    assert.strictEqual(resolveSocialTarget([], {}), 'both');
  });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`📊 Test Summary: Passed ${passed}/${total} tests!`);
  console.log('════════════════════════════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
