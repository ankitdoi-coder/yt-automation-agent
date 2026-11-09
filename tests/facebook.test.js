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
    assert.ok(svgQ.includes('भू-राजनीति'));
    assert.ok(svgQ.includes('Exam IQ Bharat'));
    assert.ok(svgQ.includes('को Follow करें'));

    const svgTimer = maker._buildSVG({ item: mockItem, timerText: '⏳ सोचो! 3.. 2.. 1.. 🎯' });
    assert.ok(svgTimer.includes('⏳ सोचो! 3.. 2.. 1.. 🎯'));

    const svgAns = maker._buildSVG({ item: mockItem, isAnswer: true });
    assert.ok(svgAns.includes('Correct Option B Highlighted'));
    assert.ok(svgAns.includes('💡 परीक्षा तथ्य (Exam Fact)'));
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

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`📊 Test Summary: Passed ${passed}/${total} tests!`);
  console.log('════════════════════════════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
