const OpenAI = require('openai');
const Replicate = require('replicate');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { Logger } = require('./logger');
const { runFFmpeg, getMediaDuration, checkFFmpeg, ffmpegInstallHint } = require('./ffmpeg');
const { MediaGenerationService } = require('./media-generation-service');
const { LETTERS, questionNarration, answerNarration, shortQuestionNarration, shortAnswerNarration, wordCount, estimateSpeechDuration, numberToHindiWords, introNarration } = require('./quiz-narration');

class AIVideoGenerator {
  constructor(credentials, options = {}) {
    this.logger = new Logger('AIVideoGenerator');
    const resolvedCredentials = credentials?.credentials || credentials || {};
    this.db = options.db || null;
    this.getMediaDuration = options.getMediaDuration || getMediaDuration;
    this.lastVideoResult = null;
    this.lastNarrationResult = null;
    
    // Initialize AI services with graceful fallback
    const openaiKey = resolvedCredentials.openai?.apiKey || process.env.OPENAI_API_KEY;
    const replicateKey = resolvedCredentials.replicate?.apiKey || process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
    
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.logger.info('OpenAI service initialized');
    } else {
      this.logger.warn('OpenAI API key not found - AI features will be simulated');
    }
    
    if (replicateKey) {
      this.replicate = new Replicate({ auth: replicateKey });
      this.logger.info('Replicate service initialized');
    } else {
      this.logger.warn('Replicate API key not found - advanced video generation unavailable');
    }

    // Gemini media generation (images + native TTS) — supports multiple API keys pool
    const rawGeminiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const geminiPool = rawGeminiKeys.split(',').map(k => k.trim()).filter(Boolean);
    const resolvedGemKey = resolvedCredentials.gemini?.apiKey || process.env.GEMINI_API_KEY || null;
    const combinedGemini = [...geminiPool];
    if (resolvedGemKey && !combinedGemini.includes(resolvedGemKey)) {
      combinedGemini.unshift(resolvedGemKey);
    }
    this.geminiApiKeys = combinedGemini;
    this.geminiApiKeyIndex = 0;
    if (this.geminiApiKeys.length > 0) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        this.gemini = new GoogleGenAI({ apiKey: this.geminiApiKeys[0] });
        this.logger.info(`Gemini media service initialized (pool of ${this.geminiApiKeys.length} key(s))`);
      } catch (error) {
        this.logger.warn('Failed to initialize Gemini media service:', error.message);
      }
    }
    
    // ElevenLabs configuration — supports key pools, voice aliases (raju, viraj, adam) or custom voice IDs
    const rawKeys = process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY || '';
    const pool = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    const resolvedKey = resolvedCredentials.elevenLabs?.apiKey || process.env.ELEVENLABS_API_KEY || null;
    const combined = [...pool];
    if (resolvedKey && !combined.includes(resolvedKey)) {
      combined.unshift(resolvedKey);
    }
    this.elevenLabsApiKeys = combined;
    this.elevenLabsApiKey = this.elevenLabsApiKeys[0] || null;
    const voiceMap = {
      adam: 'pNInz6obpgDQGcFmaJgB',
      raju: 'zT03pEAEi0VHKciJODfn',
      viraj: 'FmBhnvP58BK0vz65OOj7'
    };
    const configuredVoice = (process.env.ELEVENLABS_VOICE || process.env.ELEVENLABS_VOICE_ID || 'adam').trim();
    this.elevenLabsVoiceId = voiceMap[configuredVoice.toLowerCase()] || configuredVoice;
    this.elevenLabsModel = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
    
    // Azure Speech configuration
    this.azureSpeechKey = resolvedCredentials.azure?.speechKey || process.env.AZURE_SPEECH_KEY;
    this.azureSpeechRegion = resolvedCredentials.azure?.speechRegion || process.env.AZURE_SPEECH_REGION;

    // FreeTTS configuration (5,000 chars/day, 15,000/month free tier - fallback before Edge TTS)
    this.freeTtsApiKey = resolvedCredentials.freeTts?.apiKey || process.env.FREETTS_API_KEY || 'ft_live_YsOTCecUgXAt3d5beyVwVnlXyIurhzFU';
    this.freeTtsVoice = process.env.FREETTS_VOICE || 'hi-IN-MadhurNeural';
    if (this.freeTtsApiKey) {
      this.logger.info('FreeTTS service configured (fallback before Edge TTS)');
    }

    // Pollinations AI: OpenAI-compatible API for TTS + image generation (fallback after ElevenLabs)
    const pollinationsKey = resolvedCredentials.pollinations?.apiKey || process.env.POLLINATIONS_API_KEY;
    if (pollinationsKey) {
      this.pollinationsClient = new OpenAI({
        baseURL: 'https://gen.pollinations.ai/v1',
        apiKey: pollinationsKey
      });
      this.pollinationsTtsModel = process.env.POLLINATIONS_TTS_MODEL || 'openai/tts-1';
      this.pollinationsTtsVoice = process.env.POLLINATIONS_TTS_VOICE || 'adam';
      this.pollinationsImageModel = process.env.POLLINATIONS_IMAGE_MODEL || 'black-forest-labs/flux.1-schnell';
      this.logger.info('Pollinations AI service initialized (TTS + image generation)');
    } else {
      this.logger.warn('Pollinations API key not found - Pollinations fallback unavailable');
    }

    // AI Horde (Stable Horde) - Community GPU image generation fallback
    this.aiHordeApiKey = resolvedCredentials.aiHorde?.apiKey || process.env.AI_HORDE_API_KEY || process.env.AI_HORDE_SHARED_KEY || '129618e7-84f8-468a-8b9b-e735751a741e';
    if (this.aiHordeApiKey) {
      this.logger.info('AI Horde image generation service configured');
    }

    // Hugging Face FLUX.1-schnell image generation (100% Free tier)
    this.hfApiKey = resolvedCredentials.huggingface?.apiKey || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (this.hfApiKey) {
      this.logger.info('Hugging Face FLUX image service configured');
    }

    // OpenRouter (supports fish-audio/s2.1-pro-free:free TTS)
    this.openRouterApiKey = resolvedCredentials.openrouter?.apiKey || process.env.OPENROUTER_API_KEY;
    if (this.openRouterApiKey) {
      this.logger.info('OpenRouter integration configured (Fish Audio TTS & image support)');
    }

    this.mediaGeneration = options.mediaGeneration || (this.db
      ? new MediaGenerationService(this.db, resolvedCredentials, { logger: this.logger })
      : null);
  }

  async generateTTSAudio(text, outputPath) {
    this.logger.info('Generating TTS audio...');
    this.lastNarrationResult = null;
    let lastError = null;

    // Cooldown cache check: if a provider gave quota exceeded (429/401/402), skip it for 15 minutes
    const now = Date.now();
    const cooldownMs = 15 * 60 * 1000;
    this._ttsCooldowns = this._ttsCooldowns || {};

    const attempts = [];

    // 1. ElevenLabs: primary highest quality neural voice (Raju, Viraj, Adam)
    if (this.elevenLabsApiKey && this.elevenLabsVoiceId && (!this._ttsCooldowns.elevenlabs || (now - this._ttsCooldowns.elevenlabs > cooldownMs))) {
      attempts.push({
        provider: 'elevenlabs',
        model: this.elevenLabsModel || 'eleven_multilingual_v2',
        run: async () => {
          try {
            return await this.generateElevenLabsTTS(text, outputPath);
          } catch (err) {
            const status = err.response?.status;
            if (status === 401 || status === 402 || status === 429) {
              this._ttsCooldowns.elevenlabs = Date.now();
            }
            throw err;
          }
        }
      });
    }

    // 2. Azure Speech TTS: Official Microsoft SDK with generous free tier (500k chars/mo)
    // 100% reliable in GitHub Actions without 403 blocks (hi-IN-MadhurNeural studio voice)
    if (this.azureSpeechKey && this.azureSpeechRegion && (!this._ttsCooldowns.azure || (now - this._ttsCooldowns.azure > cooldownMs))) {
      attempts.push({
        provider: 'azure-speech',
        model: process.env.AZURE_SPEECH_VOICE || 'hi-IN-MadhurNeural',
        run: async () => {
          try {
            return await this.generateAzureTTS(text, outputPath);
          } catch (err) {
            this._ttsCooldowns.azure = Date.now();
            throw err;
          }
        }
      });
    }

    // 3. Google Gemini TTS: neural voice provider (Male Charon/Fenrir preferred)
    const geminiCooldownMs = 30 * 1000; // 30s RPM cooldown instead of 15m
    if (this.gemini && (!this._ttsCooldowns.gemini || (now - this._ttsCooldowns.gemini > geminiCooldownMs))) {
      attempts.push({
        provider: 'gemini',
        model: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
        run: async () => {
          try {
            return await this.generateGeminiTTS(text, outputPath);
          } catch (err) {
            const msg = String(err.message || '');
            if (msg.includes('429') || msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) {
              if (this.rotateGeminiKey()) {
                try {
                  return await this.generateGeminiTTS(text, outputPath);
                } catch (_) {}
              }
              this._ttsCooldowns.gemini = Date.now();
            }
            throw err;
          }
        }
      });
    }

    // 4. Microsoft Edge TTS: 100% Free, Unlimited neural voices (Madhur Male Hindi / Prabhat)
    // Clean studio audio with ZERO audio watermarks
    attempts.push({
      provider: 'edge-tts',
      model: process.env.EDGE_TTS_VOICE || 'hi-IN-MadhurNeural',
      run: () => this.generateEdgeTTS(text, outputPath)
    });

    // 5. Google Translate TTS: 100% Free, unlimited, unblockable fallback (Hindi / Indian English)
    // Guaranteed to work reliably in GitHub Actions / cloud runners where Edge WebSocket returns 403
    attempts.push({
      provider: 'google-tts',
      model: /[\u0900-\u097F]/.test(text) ? 'hi' : 'en-IN',
      run: () => this.generateGoogleTTS(text, outputPath)
    });

    // 4. Pollinations AI TTS: fallback if key has balance
    if (this.pollinationsClient && (!this._ttsCooldowns.pollinations || (now - this._ttsCooldowns.pollinations > cooldownMs))) {
      attempts.push({
        provider: 'pollinations',
        model: this.pollinationsTtsModel || 'openai/tts-1',
        run: async () => {
          try {
            return await this.generatePollinationsTTS(text, outputPath);
          } catch (err) {
            const status = err.response?.status;
            if (status === 402 || status === 429) {
              this._ttsCooldowns.pollinations = Date.now();
            }
            throw err;
          }
        }
      });
    }

    if (this.openai) {
      attempts.push({ provider: 'openai', model: 'gpt-4o-mini-tts', run: () => this.generateOpenAITTS(text, outputPath) });
    }

    attempts.push({ provider: 'simulation', model: null, run: () => this.simulateTTSGeneration(text, outputPath) });

    for (const attempt of attempts) {
      try {
        const generatedPath = await attempt.run();
        const usable = await this.isUsableAudioFile(generatedPath);
        this.lastNarrationResult = {
          status: usable ? 'ready' : 'unavailable',
          path: generatedPath,
          provider: attempt.provider,
          model: attempt.model,
          externalTaskId: null,
          generatedAt: new Date().toISOString(),
          simulated: !usable,
          cost: { provider: attempt.provider, amount: null, currency: null, invoiceRequired: attempt.provider !== 'simulation' }
        };
        if (!usable && attempt.provider !== 'simulation') {
          this.logger.warn(`TTS provider ${attempt.provider} produced no usable audio; falling back`);
          continue;
        }
        this.logger.info(`TTS generation complete via ${attempt.provider}`);
        return generatedPath;
      } catch (error) {
        lastError = error;
        this.logger.warn(`TTS attempt via ${attempt.provider} failed; trying next provider: ${error && error.message ? error.message : error}`);
      }
    }

    this.lastNarrationResult = {
      status: 'failed', path: null, provider: 'none', model: null, externalTaskId: null,
      generatedAt: new Date().toISOString(), simulated: true, error: lastError && lastError.message ? lastError.message : String(lastError),
      cost: { provider: 'simulation', amount: null, currency: null, invoiceRequired: false }
    };
    const fatal = new Error(`All TTS providers failed. Last error: ${lastError && lastError.message ? lastError.message : lastError}. Configure ElevenLabs, OpenAI, or Gemini TTS (set GEMINI_TTS_MODEL / GEMINI_TTS_VOICE) for real narration.`);
    fatal.code = 'TTS_ALL_PROVIDERS_FAILED';
    throw fatal;
  }

  async generateElevenLabsTTS(text, outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`;
    const keys = Array.isArray(this.elevenLabsApiKeys) && this.elevenLabsApiKeys.length
      ? this.elevenLabsApiKeys
      : (this.elevenLabsApiKey ? [this.elevenLabsApiKey] : []);

    if (!keys.length) {
      throw new Error('No ElevenLabs API keys configured');
    }

    this._elevenKeyCooldowns = this._elevenKeyCooldowns || {};
    const now = Date.now();
    const cooldownMs = 60 * 60 * 1000; // 1 hour per-key cooldown on quota exceeded

    let lastError = null;

    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      if (this._elevenKeyCooldowns[key] && (now - this._elevenKeyCooldowns[key] < cooldownMs)) {
        continue; // Skip exhausted key
      }

      try {
        const data = {
          text: text,
          model_id: this.elevenLabsModel,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true
          }
        };

        const response = await axios({
          method: 'POST',
          url: url,
          data: data,
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': key
          },
          responseType: 'stream'
        });

        const writer = require('fs').createWriteStream(outputPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          response.data.on('error', reject);
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        this.logger.info(`ElevenLabs TTS generation complete using Key #${k + 1}`);
        return outputPath;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const msg = err.response?.data ? String(err.response.data) : err.message;
        if (status === 401 || status === 402 || status === 429 || msg.includes('quota_exceeded')) {
          this._elevenKeyCooldowns[key] = Date.now();
          this.logger.warn(`ElevenLabs Key #${k + 1} quota exceeded (${status}); trying next key in pool...`);
        } else {
          this.logger.warn(`ElevenLabs Key #${k + 1} failed: ${err.message}; trying next key in pool...`);
        }
      }
    }

    throw lastError || new Error('All ElevenLabs API keys in pool are exhausted');
  }

  async generateOpenAITTS(text, outputPath) {
    const response = await this.openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);

    this.logger.info('OpenAI TTS generation complete');
    return outputPath;
  }

  async generateGeminiTTS(text, outputPath) {
    const preferredModel = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
    // User requested male voice - Charon set as primary (deep, confident & authoritative for GK/Quiz)
    const preferredVoice = process.env.GEMINI_TTS_VOICE || 'Charon';

    // Working free-tier Gemini models supporting AUDIO modalities
    const candidateModels = [
      preferredModel,
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
      'gemini-3.1-flash-tts-preview'
    ];
    const candidateVoices = [
      preferredVoice,
      'Charon',   // Male (Primary: deep, authoritative)
      'Fenrir',   // Male (Authoritative radio/host)
      'Puck',     // Male (Fallback)
      'Aoede',    // Female fallback (Articulate & smooth)
      'Kore'      // Female fallback
    ];
    const uniqueModels = [...new Set(candidateModels)];
    const voicesToTry = [...new Set(candidateVoices)];

    // Rotate the model list so sequential calls don't exhaust one model's RPM quota
    this._geminiModelCursor = ((this._geminiModelCursor || 0) + 1) % uniqueModels.length;
    const modelsToTry = [
      ...uniqueModels.slice(this._geminiModelCursor),
      ...uniqueModels.slice(0, this._geminiModelCursor)
    ];

    let lastError = null;
    for (const model of modelsToTry) {
      for (const voiceName of voicesToTry) {
        try {
          this.logger.info(`Requesting Gemini TTS via model: ${model} (voice: ${voiceName})`);
          const response = await this.gemini.models.generateContent({
            model,
            contents: [{ parts: [{ text }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName }
                }
              }
            }
          });

          const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!audioData) {
            throw new Error(`Gemini TTS model ${model} returned no audio data`);
          }

          // Gemini returns raw PCM (24kHz, mono, 16-bit); encode to the requested container via FFmpeg
          const pcmPath = outputPath + '.pcm';
          await fs.writeFile(pcmPath, Buffer.from(audioData, 'base64'));
          await runFFmpeg(['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcmPath, outputPath]);
          await fs.unlink(pcmPath).catch(() => {});

          this.logger.info(`Gemini TTS generation complete via ${model} (${voiceName})`);
          return outputPath;
        } catch (err) {
          lastError = err;
          const msg = err && err.message ? err.message : String(err);
          this.logger.warn(`Gemini TTS model ${model} with voice ${voiceName} failed (${msg}); trying next candidate...`);
          // If model has quota exhaustion (429), unavailable (503), or not supported / not found (404/400),
          // immediately move to next candidate model instead of retrying other voices on a broken model
          if (msg.includes('429') || msg.includes('Quota') || msg.includes('503') ||
              msg.includes('RESOURCE_EXHAUSTED') || msg.includes('NOT_FOUND') ||
              msg.includes('404') || msg.includes('not supported') || msg.includes('400')) {
            break;
          }
        }
      }
    }

    throw lastError || new Error('All Gemini TTS models failed');
  }

  rotateGeminiKey() {
    if (this.geminiApiKeys && this.geminiApiKeys.length > 1) {
      this.geminiApiKeyIndex = (this.geminiApiKeyIndex + 1) % this.geminiApiKeys.length;
      const nextKey = this.geminiApiKeys[this.geminiApiKeyIndex];
      const { GoogleGenAI } = require('@google/genai');
      this.gemini = new GoogleGenAI({ apiKey: nextKey });
      this.logger.info(`Rotated to Gemini API key #${this.geminiApiKeyIndex + 1}`);
      return true;
    }
    return false;
  }

  async generateAzureTTS(text, outputPath, options = {}) {
    if (!this.azureSpeechKey || !this.azureSpeechRegion) {
      throw new Error('Azure Speech credentials not configured');
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const isHindi = /[\u0900-\u097F]/.test(text);
    const defaultVoice = isHindi ? 'hi-IN-MadhurNeural' : 'en-IN-PrabhatNeural';
    const voice = options.voice || process.env.AZURE_SPEECH_VOICE || defaultVoice;
    this.logger.info(`Generating Azure Speech TTS audio with voice ${voice}...`);

    const sdk = require('microsoft-cognitiveservices-speech-sdk');
    const speechConfig = sdk.SpeechConfig.fromSubscription(this.azureSpeechKey, this.azureSpeechRegion);
    speechConfig.speechSynthesisVoiceName = voice;
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    return new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        result => {
          synthesizer.close();
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            this.logger.info(`Azure Speech TTS generation complete: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error(`Azure Speech synthesis failed: ${result.errorDetails || result.reason}`));
          }
        },
        error => {
          synthesizer.close();
          reject(error);
        }
      );
    });
  }

  async generateEdgeTTS(text, outputPath, options = {}) {
    const isHindi = /[\u0900-\u097F]/.test(text);
    // Strictly Male voices: hi-IN-MadhurNeural (Hindi Male), en-IN-PrabhatNeural (English Male)
    const defaultVoice = isHindi ? 'hi-IN-MadhurNeural' : 'en-IN-PrabhatNeural';
    const voiceName = options.voice || process.env.EDGE_TTS_VOICE || defaultVoice;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    this.logger.info(`Generating Edge TTS audio with voice ${voiceName}...`);

    // 1. Try Python edge-tts CLI first (avoids 403 on cloud runners like GitHub Actions)
    const pythonCommands = [
      { cmd: 'python3', args: ['-m', 'edge_tts', '--text', text, '--write-media', outputPath, '--voice', voiceName] },
      { cmd: 'edge-tts', args: ['--text', text, '--write-media', outputPath, '--voice', voiceName] },
      { cmd: 'python', args: ['-m', 'edge_tts', '--text', text, '--write-media', outputPath, '--voice', voiceName] }
    ];

    for (const { cmd, args } of pythonCommands) {
      try {
        const { execFile } = require('child_process');
        const util = require('util');
        const execFileAsync = util.promisify(execFile);
        await execFileAsync(cmd, args, { timeout: 30000 });

        if (await this.isUsableAudioFile(outputPath)) {
          this.logger.info(`Edge TTS (CLI via ${cmd}) audio generation complete: ${outputPath}`);
          return outputPath;
        }
      } catch (cliErr) {
        this.logger.debug(`Edge TTS CLI attempt via ${cmd} failed: ${cliErr && cliErr.message ? cliErr.message : cliErr}`);
      }
    }

    // 2. Fallback to MsEdgeTTS Node.js library
    const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text);

      await new Promise((resolve, reject) => {
        const fileStream = require('fs').createWriteStream(outputPath);
        audioStream.pipe(fileStream);
        fileStream.on('finish', resolve);
        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });

      this.logger.info(`Edge TTS audio generation complete: ${outputPath}`);
      return outputPath;
    } finally {
      try { tts.close(); } catch (_) {}
    }
  }

  async generateGoogleTTS(text, outputPath, options = {}) {
    const isHindi = /[\u0900-\u097F]/.test(text);
    const lang = options.lang || (isHindi ? 'hi' : 'en-IN');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    this.logger.info(`Generating Google TTS audio (${lang})...`);

    // 1. Try Python gTTS CLI if available on the system
    const gttsCommands = [
      { cmd: 'gtts-cli', args: [text, '--lang', lang, '--output', outputPath] },
      { cmd: 'python3', args: ['-m', 'gtts', text, '--lang', lang, '--output', outputPath] },
      { cmd: 'python', args: ['-m', 'gtts', text, '--lang', lang, '--output', outputPath] }
    ];

    for (const { cmd, args } of gttsCommands) {
      try {
        const { execFile } = require('child_process');
        const util = require('util');
        const execFileAsync = util.promisify(execFile);
        await execFileAsync(cmd, args, { timeout: 30000 });
        if (await this.isUsableAudioFile(outputPath)) {
          this.logger.info(`Google TTS (CLI via ${cmd}) audio generation complete: ${outputPath}`);
          return outputPath;
        }
      } catch (_) {
        // Fall back to direct HTTP
      }
    }

    // 2. Direct HTTPS Google Translate TTS (ultra-reliable, 0 auth, 0 rate limit)
    const chunkText = (str, maxLen = 180) => {
      const words = str.split(/\s+/);
      const chunks = [];
      let current = '';
      for (const word of words) {
        if ((current ? current + ' ' + word : word).length <= maxLen) {
          current = current ? current + ' ' + word : word;
        } else {
          if (current) chunks.push(current);
          current = word;
        }
      }
      if (current) chunks.push(current);
      return chunks.length ? chunks : [str.slice(0, maxLen)];
    };

    const chunks = chunkText(text.trim(), 180);
    const audioBuffers = [];

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(chunk)}`;
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        },
        timeout: 20000
      });

      if (!res.data || res.data.length < 100) {
        throw new Error(`Google TTS returned invalid audio for chunk: "${chunk.substring(0, 30)}..."`);
      }
      audioBuffers.push(Buffer.from(res.data));
    }

    if (audioBuffers.length === 0) {
      throw new Error('Google TTS produced no audio chunks');
    }

    const combinedBuffer = Buffer.concat(audioBuffers);
    await fs.writeFile(outputPath, combinedBuffer);

    this.logger.info(`Google TTS (${lang}) audio generation complete (${combinedBuffer.length} bytes): ${outputPath}`);
    return outputPath;
  }


  async generateOpenRouterFishTTS(text, outputPath) {
    if (!this.openRouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    this.logger.info('Generating OpenRouter Fish Audio TTS (s2.1-pro-free:free)...');

    const res = await axios.post(
      'https://openrouter.ai/api/v1/audio/speech',
      {
        model: 'fish-audio/s2.1-pro-free:free',
        input: text,
        voice: 'alloy'
      },
      {
        headers: {
          Authorization: `Bearer ${this.openRouterApiKey}`,
          'HTTP-Referer': 'https://github.com/ExamIQ/youtube-automation-agent',
          'X-Title': 'ExamIQ Automation Agent',
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 45000
      }
    );

    await fs.writeFile(outputPath, Buffer.from(res.data));
    this.logger.info(`OpenRouter Fish Audio TTS generation complete: ${outputPath}`);
    return outputPath;
  }

  async generateFreeTTS(text, outputPath, options = {}) {
    if (!this.freeTtsApiKey) {
      throw new Error('No FreeTTS API key configured');
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const isHindi = /[\u0900-\u097F]/.test(text);
    const defaultVoice = isHindi ? 'hi-IN-MadhurNeural' : 'en-US-JennyNeural';
    const voice = options.voice || this.freeTtsVoice || defaultVoice;

    this.logger.info(`Generating FreeTTS audio with voice ${voice}...`);

    const headers = {
      'x-api-key': this.freeTtsApiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    };

    const payload = {
      text,
      voice,
      style: options.style || 'cheerful',
      output_format: 'mp3'
    };

    const response = await axios.post('https://freetts.org/api/v1/tts', payload, {
      headers,
      timeout: 30000
    });

    const data = response.data;
    if (!data) {
      throw new Error('FreeTTS returned empty response');
    }

    let audioUrl = data.audio_url || data.url;
    if (!audioUrl && data.file_id) {
      audioUrl = `https://freetts.org/api/audio/${data.file_id}`;
    }

    if (!audioUrl && Buffer.isBuffer(data)) {
      await fs.writeFile(outputPath, data);
      this.logger.info(`FreeTTS audio saved directly to: ${outputPath}`);
      return outputPath;
    }

    if (!audioUrl) {
      throw new Error(`FreeTTS did not return an audio URL: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
    }

    const audioRes = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    await fs.writeFile(outputPath, Buffer.from(audioRes.data));
    this.logger.info(`FreeTTS audio downloaded and saved: ${outputPath}`);
    return outputPath;
  }

  async generatePollinationsTTS(text, outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const model = this.pollinationsTtsModel || 'openai/tts-1';
    let voice = this.pollinationsTtsVoice || 'onyx';
    // openai/tts-1 supports: onyx, echo, fable, alloy, nova, shimmer
    // If voice is set to adam (ElevenLabs default), map to onyx (deep male narrator)
    if (model.includes('openai') && !['onyx', 'echo', 'fable', 'alloy', 'nova', 'shimmer'].includes(voice)) {
      voice = 'onyx';
    }

    this.logger.info(`Generating Pollinations TTS audio with model ${model}, voice ${voice}...`);

    try {
      const response = await this.pollinationsClient.audio.speech.create({
        model,
        voice,
        input: text,
        speed: 1.0
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outputPath, buffer);

      this.logger.info('Pollinations TTS generation complete via OpenAI client');
      return outputPath;
    } catch (err) {
      this.logger.warn(`Pollinations SDK speech failed (${err.message}), trying direct audio endpoint...`);
      const res = await axios.get(`https://gen.pollinations.ai/audio/${encodeURIComponent(text)}?model=${encodeURIComponent(model)}&voice=${encodeURIComponent(voice)}`, {
        headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
        responseType: 'arraybuffer',
        timeout: 60000
      });
      await fs.writeFile(outputPath, Buffer.from(res.data));
      this.logger.info('Pollinations TTS generation complete via direct audio endpoint');
      return outputPath;
    }
  }

  async generateVisualAssets(prompt, style = "ethereal", count = 1) {
    this.logger.info(`Generating ${count} visual assets with style: ${style}`);

    try {
      if (!this.openai && !this.gemini && !this.pollinationsClient) {
        return await this.simulateVisualAssets(prompt, style, count);
      }

      const enhancedPrompt = this.enhanceVisualPrompt(prompt, style);
      const localPaths = [];

      for (let i = 0; i < count; i++) {
        const imagePath = path.join(__dirname, '..', 'data', 'assets', `visual_${Date.now()}_${i}.png`);
        await this.generateImage(enhancedPrompt, imagePath);
        localPaths.push(imagePath);
      }

      this.logger.info(`Generated ${localPaths.length} visual assets`);
      return localPaths;
    } catch (error) {
      this.logger.error('Visual asset generation failed:', error);
      return await this.simulateVisualAssets(prompt, style, count);
    }
  }

  async generateImage(prompt, imagePath) {
    await fs.mkdir(path.dirname(imagePath), { recursive: true });

    const attempts = [];
    if (this.openai) {
      attempts.push({ provider: 'openai', run: () => this.generateOpenAIImage(prompt, imagePath) });
    }
    if (this.hfApiKey) {
      attempts.push({ provider: 'huggingface-flux', run: () => this.generateHuggingFaceImage(prompt, imagePath) });
    }
    if (this.gemini) {
      attempts.push({ provider: 'gemini', run: () => this.generateGeminiImage(prompt, imagePath) });
    }
    if (this.pollinationsClient) {
      attempts.push({ provider: 'pollinations', run: () => this.generatePollinationsImage(prompt, imagePath) });
    }
    if (this.aiHordeApiKey) {
      attempts.push({ provider: 'ai-horde', run: () => this.generateAIHordeImage(prompt, imagePath) });
    }

    if (attempts.length === 0) {
      throw new Error('No image generation provider configured');
    }

    let lastError = null;
    for (const attempt of attempts) {
      try {
        this.logger.info(`Attempting image generation via ${attempt.provider}...`);
        const result = await attempt.run();
        this.logger.info(`Image generation succeeded via ${attempt.provider}`);
        return result;
      } catch (err) {
        lastError = err;
        this.logger.warn(`Image generation via ${attempt.provider} failed: ${err.message || err}. Trying next provider...`);
      }
    }

    throw lastError || new Error('All image generation providers failed');
  }

  async generateHuggingFaceImage(prompt, imagePath) {
    if (!this.hfApiKey) {
      throw new Error('Hugging Face API token not configured');
    }
    const model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
    this.logger.info(`Generating Hugging Face image visual using model ${model}...`);
    let buffer;
    try {
      const { HfInference } = require('@huggingface/inference');
      const hf = new HfInference(this.hfApiKey);
      const blob = await hf.textToImage({
        model,
        inputs: prompt
      });
      buffer = Buffer.from(await blob.arrayBuffer());
    } catch (sdkErr) {
      this.logger.warn(`HfInference SDK failed (${sdkErr.message}), falling back to direct endpoint...`);
      const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`;
      const res = await axios.post(
        endpoint,
        { inputs: prompt },
        {
          headers: {
            Authorization: `Bearer ${this.hfApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );
      buffer = Buffer.from(res.data);
    }
    const extension = path.extname(imagePath).toLowerCase();
    const output = sharp(buffer, { failOn: 'error' });
    if (extension === '.jpg' || extension === '.jpeg') {
      await output.jpeg({ quality: 92 }).toFile(imagePath);
    } else if (extension === '.webp') {
      await output.webp({ quality: 92 }).toFile(imagePath);
    } else {
      await output.png().toFile(imagePath);
    }
    return imagePath;
  }

  async generateAIHordeImage(prompt, imagePath) {
    if (!this.aiHordeApiKey) {
      throw new Error('AI Horde API key not configured');
    }
    this.logger.info('Generating AI Horde visual asset...');

    // 1. Submit async generation request
    const postRes = await axios.post('https://stablehorde.net/api/v2/generate/async', {
      prompt: prompt,
      params: {
        width: 896,
        height: 512,
        steps: 22,
        cfg_scale: 7.0,
        sampler_name: 'k_euler'
      },
      nsfw: false,
      censor_nsfw: true
    }, {
      headers: {
        'apikey': this.aiHordeApiKey,
        'Client-Agent': 'ExamIQ-Agent:1.0:aj'
      },
      timeout: 30000
    });

    const id = postRes.data?.id;
    if (!id) {
      throw new Error('AI Horde did not return a generation job ID');
    }

    // 2. Poll until done or timeout (max 45 seconds)
    const startTime = Date.now();
    let isDone = false;
    while (!isDone && (Date.now() - startTime < 45000)) {
      await new Promise(r => setTimeout(r, 2000));
      const checkRes = await axios.get(`https://stablehorde.net/api/v2/generate/check/${id}`, {
        headers: { 'Client-Agent': 'ExamIQ-Agent:1.0:aj' },
        timeout: 10000
      });
      if (checkRes.data?.done) {
        isDone = true;
      } else if (checkRes.data?.faulted) {
        throw new Error('AI Horde job faulted');
      }
    }

    // 3. Fetch status and download image
    const statusRes = await axios.get(`https://stablehorde.net/api/v2/generate/status/${id}`, {
      headers: { 'Client-Agent': 'ExamIQ-Agent:1.0:aj' },
      timeout: 15000
    });

    const generation = statusRes.data?.generations?.[0];
    if (!generation || !generation.img) {
      throw new Error('AI Horde generation completed without an image');
    }

    let buffer;
    if (generation.img.startsWith('http://') || generation.img.startsWith('https://')) {
      const imgRes = await axios.get(generation.img, { responseType: 'arraybuffer', timeout: 30000 });
      buffer = Buffer.from(imgRes.data);
    } else {
      buffer = Buffer.from(generation.img, 'base64');
    }

    const extension = path.extname(imagePath).toLowerCase();
    const output = sharp(buffer, { failOn: 'error' });
    if (extension === '.jpg' || extension === '.jpeg') {
      await output.jpeg({ quality: 92 }).toFile(imagePath);
    } else if (extension === '.webp') {
      await output.webp({ quality: 92 }).toFile(imagePath);
    } else {
      await output.png().toFile(imagePath);
    }

    return imagePath;
  }

  async generatePollinationsImage(prompt, imagePath) {
    const model = this.pollinationsImageModel || 'flux';
    this.logger.info(`Generating Pollinations visual asset with model: ${model}...`);

    try {
      const response = await this.pollinationsClient.images.generate({
        model,
        prompt,
        n: 1,
        size: '1280x720'
      });

      if (response.data?.[0]?.b64_json) {
        const buffer = Buffer.from(response.data[0].b64_json, 'base64');
        const extension = path.extname(imagePath).toLowerCase();
        const output = sharp(buffer, { failOn: 'error' });
        if (extension === '.jpg' || extension === '.jpeg') {
          await output.jpeg({ quality: 92 }).toFile(imagePath);
        } else if (extension === '.webp') {
          await output.webp({ quality: 92 }).toFile(imagePath);
        } else {
          await output.png().toFile(imagePath);
        }
        return imagePath;
      } else if (response.data?.[0]?.url) {
        await this.downloadImage(response.data[0].url, imagePath);
        return imagePath;
      }
    } catch (sdkError) {
      this.logger.warn(`Pollinations SDK image call failed (${sdkError.message}), trying direct GET endpoint...`);
    }

    let buffer;
    try {
      // Direct GET endpoint fallback with bearer token
      const directUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=1280&height=720&nologo=true`;
      const directRes = await axios.get(directUrl, {
        headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
        responseType: 'arraybuffer',
        timeout: 60000
      });
      buffer = Buffer.from(directRes.data);
    } catch (directErr) {
      this.logger.warn(`Pollinations authenticated endpoint failed (${directErr.message}), trying 100% free public endpoint...`);
      const freeUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true`;
      const freeRes = await axios.get(freeUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      buffer = Buffer.from(freeRes.data);
    }
    const extension = path.extname(imagePath).toLowerCase();
    const output = sharp(buffer, { failOn: 'error' });
    if (extension === '.jpg' || extension === '.jpeg') {
      await output.jpeg({ quality: 92 }).toFile(imagePath);
    } else if (extension === '.webp') {
      await output.webp({ quality: 92 }).toFile(imagePath);
    } else {
      await output.png().toFile(imagePath);
    }
    return imagePath;
  }

  async generateOpenAIImage(prompt, imagePath) {
    const response = await this.openai.images.generate({
      model: "gpt-image-2",
      prompt: prompt,
      n: 1,
      size: "1536x1024",
      quality: "high",
    });

    if (response.data[0].b64_json) {
      const buffer = Buffer.from(response.data[0].b64_json, 'base64');
      await fs.writeFile(imagePath, buffer);
    } else {
      await this.downloadImage(response.data[0].url, imagePath);
    }

    return imagePath;
  }

  async generateGeminiImage(prompt, imagePath) {
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';

    const response = await this.gemini.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '1K'
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imageParts = parts.filter(part =>
      part.inlineData?.data && (!part.inlineData.mimeType || part.inlineData.mimeType.startsWith('image/'))
    );
    const renderedImages = imageParts.filter(part => part.thought !== true);
    const imagePart = (renderedImages.length ? renderedImages : imageParts).at(-1);
    if (!imagePart) {
      throw new Error('Gemini image generation returned no image data');
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const metadata = await sharp(imageBuffer, { failOn: 'error' }).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Gemini image generation returned an invalid image asset');
    }

    const extension = path.extname(imagePath).toLowerCase();
    const output = sharp(imageBuffer, { failOn: 'error' });
    if (extension === '.jpg' || extension === '.jpeg') {
      await output.jpeg({ quality: 92 }).toFile(imagePath);
    } else if (extension === '.webp') {
      await output.webp({ quality: 92 }).toFile(imagePath);
    } else {
      await output.png().toFile(imagePath);
    }
    return imagePath;
  }

  enhanceVisualPrompt(prompt, style) {
    const styleEnhancements = {
      ethereal: "ethereal, dreamy, mystical, soft lighting, floating particles, cosmic background, 16:9 aspect ratio, digital art",
      modern: "modern, clean, minimalist, professional, sleek design, contemporary, 16:9 aspect ratio",
      animated: "animated style, cartoon, vibrant colors, expressive, dynamic, 16:9 aspect ratio",
      cinematic: "cinematic lighting, dramatic, movie poster style, high contrast, 16:9 aspect ratio",
      abstract: "abstract art, geometric shapes, gradient colors, artistic composition, 16:9 aspect ratio",
      educational: "realistic educational documentary photo, clear real-world subject, authentic, natural lighting, high detail",
      quiz: "authentic documentary photography, clear subject focus, natural cinematic lighting, National Geographic style, highly detailed, realistic, clean view",
      quiz_visuals: "authentic documentary photography, clear subject focus, natural cinematic lighting, National Geographic style, highly detailed, realistic, clean view"
    };

    const normalizedStyle = String(style || '').trim().toLowerCase();
    const enhancement = styleEnhancements[normalizedStyle] || String(style || '').trim() || styleEnhancements.ethereal;
    return `${prompt}, ${enhancement}, high quality, no text, no letters, no words, no watermark, no logos in the image`;
  }

  async downloadImage(url, outputPath) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async generateVideo(script, visualAssets, audioPath, outputPath, options = {}) {
    this.logger.info('Generating video from assets...');
    this.lastVideoResult = null;
    const isQuiz = Boolean(script?.quiz?.questions?.length);
    try {
      if (!isQuiz && this.mediaGeneration && options.productionId) {
        const generated = await this.mediaGeneration.generateClips({
          jobId: options.jobId || null,
          productionId: options.productionId,
          script,
          visualAssets,
          outputDir: path.dirname(outputPath)
        });
        if (generated.clips.length) {
          const produced = await this.generateHybridVideo(
            generated.clips,
            visualAssets,
            audioPath,
            outputPath,
            options.estimatedDuration || this.calculateScriptDuration(script)
          );
          this.lastVideoResult = {
            requestedProvider: generated.requestedProvider,
            actualProvider: generated.actualProvider,
            model: generated.model,
            mode: generated.settings.mode,
            generatedSeconds: generated.clips.reduce((total, clip) => total + clip.duration, 0),
            tasks: generated.clips.map(clip => ({ scene: clip.index, taskId: clip.taskId, provider: clip.provider, model: clip.model })),
            scenes: generated.clips.map(clip => ({
              index: clip.index, label: clip.label, prompt: clip.prompt, duration: clip.duration,
              path: clip.path, taskId: clip.taskId, provider: clip.provider, model: clip.model
            }))
          };
          return produced;
        }
      }

      const produced = await this.generateSlideshowVideo(script, visualAssets, audioPath, outputPath, options);
      this.lastVideoResult = { requestedProvider: 'slideshow', actualProvider: 'slideshow', model: 'local-ffmpeg', mode: 'slideshow', generatedSeconds: 0, tasks: [], scenes: [] };
      return produced;
    } catch (error) {
      // The Logger's console line only shows the message string, so put the real
      // reason inline. Previously the stack alone went to the file transport and
      // the console printed "Video generation failed:" with no detail.
      const reason = error && error.message ? error.message : String(error);
      this.logger.error(`Video provider generation failed; using the local slideshow: ${reason}`, error);
      try {
        const produced = await this.generateSlideshowVideo(script, visualAssets, audioPath, outputPath, options);
        this.lastVideoResult = {
          requestedProvider: this.lastVideoResult?.requestedProvider || 'configured-provider',
          actualProvider: 'slideshow', model: 'local-ffmpeg', mode: 'fallback', generatedSeconds: 0,
          fallbackReason: reason, tasks: [], scenes: []
        };
        return produced;
      } catch (fallbackError) {
        this.logger.error(`Local slideshow fallback failed: ${fallbackError.message}`, fallbackError);
        const produced = await this.simulateVideoGeneration(script, visualAssets, audioPath, outputPath);
        this.lastVideoResult = {
          requestedProvider: 'configured-provider', actualProvider: 'simulation', model: null,
          mode: 'simulation', generatedSeconds: 0, fallbackReason: `${reason}; ${fallbackError.message}`, tasks: [], scenes: []
        };
        return produced;
      }
    }
  }

  async generateHybridVideo(clips, visualAssets, audioPath, outputPath, totalDuration) {
    if (!(await checkFFmpeg())) throw new Error(ffmpegInstallHint());
    const validImages = await this.filterLocalImageAssets(visualAssets);
    const segments = clips.map(clip => ({ type: 'video', path: clip.path, duration: clip.duration }));
    const generatedDuration = segments.reduce((sum, item) => sum + item.duration, 0);
    const remaining = Math.max(0, this.parseDurationSeconds(totalDuration) - generatedDuration);
    if (remaining && validImages.length) {
      const perImage = Math.max(2, remaining / validImages.length);
      for (const imagePath of validImages) segments.push({ type: 'image', path: imagePath, duration: perImage });
    }
    if (!segments.length) throw new Error('No usable provider clips or still images were generated');

    const visualPath = outputPath.replace(/\.mp4$/i, '_hybrid_visual.mp4');
    await this.renderMediaTimeline(segments, visualPath);
    await this.addAudioToVideo(visualPath, audioPath, outputPath, { loopVideo: true });
    await fs.unlink(visualPath).catch(() => {});
    return outputPath;
  }

  async renderMediaTimeline(segments, outputPath) {
    const args = ['-y'];
    for (const segment of segments) {
      if (segment.type === 'image') args.push('-loop', '1', '-t', Number(segment.duration).toFixed(2), '-framerate', '30', '-i', segment.path);
      else args.push('-stream_loop', '-1', '-i', segment.path);
    }
    const filters = segments.map((segment, index) =>
      `[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p,trim=duration=${Number(segment.duration).toFixed(2)},setpts=PTS-STARTPTS[v${index}]`
    );
    filters.push(`${segments.map((_, index) => `[v${index}]`).join('')}concat=n=${segments.length}:v=1:a=0[vout]`);
    args.push('-filter_complex', filters.join(';'), '-map', '[vout]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath);
    await runFFmpeg(args);
    return outputPath;
  }

  async filterLocalImageAssets(visualAssets = []) {
    const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    const images = [];
    for (const asset of visualAssets) {
      if (typeof asset !== 'string' || !imageExtensions.has(path.extname(asset).toLowerCase())) continue;
      try {
        await fs.access(asset);
        images.push(asset);
      } catch (_error) { /* ignore missing assets */ }
    }
    return images;
  }

  parseDurationSeconds(value) {
    if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
    const parts = String(value || '').split(':').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) return Math.max(0, parts[0] * 60 + parts[1]);
    if (parts.length === 3 && parts.every(Number.isFinite)) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    return 0;
  }

  async generateReplicateVideo(script, visualAssets, audioPath, outputPath) {
    const output = await this.replicate.run(
      "wan-video/wan-2.7-i2v",
      {
        input: {
          image: visualAssets[0],
          prompt: script.title || "smooth cinematic motion",
          duration: 5,
          resolution: "720p"
        }
      }
    );

    // Download the generated video
    if (output && output.length > 0) {
      await this.downloadVideo(output[0], outputPath);
      
      // Add audio track
      await this.addAudioToVideo(outputPath, audioPath, outputPath);
    }

    return outputPath;
  }

  async generateSlideshowVideo(script, visualAssets, audioPath, outputPath, options = {}) {
    this.logger.info('Creating slideshow video...');

    if (!(await checkFFmpeg())) {
      throw new Error(ffmpegInstallHint());
    }

    const { chromium } = require('playwright');
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage();
    const slidesDir = path.join(path.dirname(outputPath), 'slides');

    try {
      const isShort = Boolean(
        script.isShort ||
        script.quiz?.isShort ||
        options.isShort ||
        String(script.metadata?.strategy?.contentType || '').toLowerCase() === 'quiz_short' ||
        String(script.metadata?.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short' ||
        String(script.metadata?.strategy?.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
        String(script.metadata?.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short_no_image'
      );
      const vWidth = isShort ? 1080 : 1920;
      const vHeight = isShort ? 1920 : 1080;
      await page.setViewportSize({ width: vWidth, height: vHeight });

      // Create HTML for slideshow (only real image files can be embedded)
      const imageAssets = await this.filterImageAssets(visualAssets);
      const slides = this.buildSlideData(script, imageAssets);
      await page.setContent(this.createSlideshowHTML(script, imageAssets, slides), { waitUntil: 'domcontentloaded' });
      // Ensure Hindi/Devanagari web fonts and system fonts are fully loaded before capturing stills
      await page.evaluate(async () => {
        try {
          if (document.fonts) {
            await document.fonts.ready;
          }
        } catch (_) {}
      }).catch(() => {});
      await page.waitForTimeout(1500); // Buffer for remote font rendering and layout stabilization

      // Capture ONE still per slide instead of screenshotting at 30fps —
      // FFmpeg turns the stills into a crossfaded video in seconds.
      const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
      await fs.mkdir(slidesDir, { recursive: true });

      const stills = [];
      for (let i = 0; i < slideCount; i++) {
        await page.evaluate((index) => {
          document.querySelectorAll('.slide').forEach((slide, s) => {
            const isActive = s === index;
            slide.classList.toggle('active', isActive);
            slide.style.opacity = isActive ? '1' : '0';
            slide.style.visibility = isActive ? 'visible' : 'hidden';
            slide.style.display = isActive ? '' : 'none';
          });
        }, i);

        const stillPath = path.join(slidesDir, `slide_${String(i).padStart(3, '0')}.png`);
        await page.screenshot({ path: stillPath });
        stills.push(stillPath);
      }

      const videoPath = outputPath.replace('.mp4', '_visual.mp4');
      const duration = await this.resolveSlideshowDuration(script, audioPath);
      const quizDurations = script.quiz?.questions?.length
        ? await this.resolveQuizSlideDurations(slides, duration, audioPath, options)
        : null;
      const renderOptions = quizDurations
        ? {
            // Quiz slides hold the screen while their own narration line is read,
            // so their durations follow the spoken audio segments instead of an
            // even split. Straight cuts match the reference quiz channels.
            durations: quizDurations,
            transition: 'cut'
          }
        : {};
      const targetDuration = quizDurations
        ? quizDurations.reduce((sum, d) => sum + d, 0)
        : duration;
      await this.renderSlidesToVideo(stills, targetDuration, videoPath, renderOptions);

      // Add audio
      await this.addAudioToVideo(videoPath, audioPath, outputPath);

      return outputPath;
    } finally {
      await browser.close().catch(() => {});
      await this.cleanupDirectory(slidesDir);
    }
  }

  async resolveSlideshowDuration(script, audioPath) {
    try {
      return (await this.getMediaDuration(audioPath)) + 0.5;
    } catch (error) {
      this.logger.warn(`Could not read narration duration, falling back to word-count estimate: ${error.message}`);
      return this.calculateScriptDuration(script);
    }
  }

  async renderSlidesToVideo(stills, totalDuration, videoPath, options = {}) {
    if (stills.length === 0) {
      throw new Error('No slides to render');
    }

    if (stills.length === 1) {
      await runFFmpeg([
        '-y', '-loop', '1', '-t', totalDuration.toFixed(2),
        '-framerate', '30', '-i', stills[0],
        '-vf', 'format=yuv420p', '-c:v', 'libx264', videoPath
      ]);
      return videoPath;
    }

    const useCuts = options.transition === 'cut' && stills.length > 1;
    const fade = 0.5;

    if (useCuts) {
      // Concat demuxer: sample-accurate, frame-locked slide timing with zero cumulative drift
      const perSlideDurations = Array.isArray(options.durations) && options.durations.length === stills.length
        ? options.durations.map(value => Math.max(1.0, Number(value) || 0))
        : stills.map(() => Math.max(2, totalDuration / stills.length));

      const concatListPath = path.join(path.dirname(videoPath), `stills_concat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.txt`);
      const lines = [];
      for (let i = 0; i < stills.length; i++) {
        const stillFilePath = path.resolve(stills[i]).replace(/\\/g, '/');
        const dur = Number(perSlideDurations[i]);
        lines.push(`file '${stillFilePath}'`);
        lines.push(`duration ${dur.toFixed(3)}`);
      }
      // FFmpeg concat demuxer requires repeating the last file without duration to define its end
      lines.push(`file '${path.resolve(stills[stills.length - 1]).replace(/\\/g, '/')}'`);
      await fs.writeFile(concatListPath, lines.join('\n'), 'utf8');

      try {
        await runFFmpeg([
          '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
          '-vf', 'fps=30,format=yuv420p',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          videoPath
        ]);
        return videoPath;
      } finally {
        await fs.unlink(concatListPath).catch(() => {});
      }
    }

    const overlapDuration = fade * Math.max(0, stills.length - 1);
    const perSlide = Math.max(2, (totalDuration + overlapDuration) / stills.length);

    const args = ['-y'];
    for (let index = 0; index < stills.length; index++) {
      args.push('-loop', '1', '-t', perSlide.toFixed(2), '-framerate', '30', '-i', stills[index]);
    }

    if (stills.length === 1) {
      args.push('-vf', 'format=yuv420p', '-c:v', 'libx264', videoPath);
      await runFFmpeg(args);
      return videoPath;
    }

    // Chain crossfades: transition k starts fade seconds before slide k ends
    const filters = [];
    let prev = '[0:v]';
    let elapsed = 0;
    for (let i = 1; i < stills.length; i++) {
      const out = `[v${i}]`;
      elapsed += perSlide;
      const offset = (elapsed - fade * i).toFixed(2);
      filters.push(`${prev}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset}${out}`);
      prev = out;
    }
    filters.push(`${prev}format=yuv420p[vfinal]`);

    args.push(
      '-filter_complex', filters.join(';'),
      '-map', '[vfinal]',
      '-c:v', 'libx264',
      '-r', '30',
      videoPath
    );

    await runFFmpeg(args);
    return videoPath;
  }

  async filterImageAssets(visualAssets = []) {
    const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    const mimeTypes = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp'
    };
    const images = [];

    for (const asset of visualAssets) {
      if (typeof asset !== 'string' || !imageExtensions.has(path.extname(asset).toLowerCase())) {
        continue;
      }

      try {
        const imageBuffer = await fs.readFile(asset);
        const metadata = await sharp(imageBuffer, { failOn: 'error' }).metadata();
        const mimeType = mimeTypes[metadata.format];
        if (mimeType && metadata.width && metadata.height) {
          images.push(`data:${mimeType};base64,${imageBuffer.toString('base64')}`);
        }
      } catch (_error) {
        // Skip missing or invalid image files
      }
    }

    return images;
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  truncateText(value, maxLength) {
    const text = String(value ?? '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  }

  // Slide text: prefer the script writer's on-screen direction, otherwise
  // derive short skimmable fragments from the spoken content.
  deriveSlideBullets(section) {
    const cleaned = [];
    const push = value => {
      const text = this.truncateText(value, 80);
      if (text && !text.startsWith('[')) cleaned.push(text);
    };

    if (Array.isArray(section.bullets) && section.bullets.length) {
      section.bullets.forEach(push);
      return cleaned.slice(0, 4);
    }

    if (Array.isArray(section.content)) {
      section.content.forEach(push);
    } else if (Array.isArray(section.steps)) {
      section.steps.forEach(step => push(`${step.title}. ${step.description || ''}`));
    } else if (Array.isArray(section.items)) {
      section.items.forEach(item => push(`${item.number}. ${item.title}`));
    } else if (typeof section.content === 'string' && section.content.trim()) {
      section.content
        .split(/(?<=[.!?])\s+/)
        .forEach(sentence => push(sentence));
    }

    if (!cleaned.length) {
      push(section.onScreen || section.title || '');
    }
    return cleaned.slice(0, 4);
  }

  createSlideshowHTML(script, visualAssets, slides = null) {
    const isShort = Boolean(
      script.isShort ||
      script.quiz?.isShort ||
      String(script.metadata?.strategy?.contentType || '').toLowerCase() === 'quiz_short' ||
      String(script.metadata?.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short' ||
      String(script.metadata?.strategy?.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
      String(script.metadata?.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short_no_image'
    );
    const bodyWidth = isShort ? 1080 : 1920;
    const bodyHeight = isShort ? 1920 : 1080;
    const slideData = slides || this.buildSlideData(script, visualAssets);
    const slidesHtml = slideData.map(slide => this.renderSlideHtml(slide)).join('\n');
    const channel = this.escapeHtml(script.metadata?.strategy?.channelName || '');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after {
            box-sizing: border-box;
            transition: none !important;
            animation: none !important;
        }
        body {
            margin: 0;
            padding: 0;
            width: ${bodyWidth}px;
            height: ${bodyHeight}px;
            background: #0b1220;
            font-family: 'Nirmala UI', 'Noto Sans Devanagari', 'Mangal', 'Segoe UI', Arial, sans-serif;
            overflow: hidden;
            color: #f4f6fb;
        }

        .slide {
            position: absolute;
            width: 100%;
            height: 100%;
            opacity: 0;
            visibility: hidden;
            background:
                radial-gradient(1200px 800px at 78% -10%, var(--accent-glow), transparent 60%),
                linear-gradient(135deg, #0b1220 0%, #131a2e 55%, #1a2340 100%);
        }

        .slide.active {
            opacity: 1;
            visibility: visible;
        }

        .bg-image {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* Dark scrims keep text readable over any generated image */
        .scrim {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, rgba(7, 11, 22, 0.94) 0%, rgba(7, 11, 22, 0.82) 42%, rgba(7, 11, 22, 0.30) 100%);
        }
        .scrim-bottom {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            height: 220px;
            background: linear-gradient(180deg, transparent, rgba(7, 11, 22, 0.9));
        }

        .frame {
            position: absolute;
            inset: 0;
            padding: 90px 110px 120px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .kicker {
            display: flex;
            align-items: center;
            gap: 18px;
            font-size: 26px;
            font-weight: 600;
            letter-spacing: 6px;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 42px;
        }
        .kicker .line { width: 64px; height: 3px; background: var(--accent); border-radius: 2px; }

        h1 {
            font-size: 96px;
            line-height: 1.08;
            margin: 0 0 36px;
            font-weight: 800;
            letter-spacing: -1px;
            max-width: 1450px;
        }
        h1.medium { font-size: 76px; }
        h1.small { font-size: 62px; }

        .subtitle {
            font-size: 38px;
            line-height: 1.45;
            color: #b9c2d8;
            max-width: 1200px;
            margin: 0;
        }

        ul.points { list-style: none; margin: 10px 0 0; padding: 0; max-width: 1250px; }
        ul.points li {
            position: relative;
            font-size: 40px;
            line-height: 1.35;
            color: #dbe2f1;
            padding: 18px 0 18px 58px;
        }
        ul.points li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 34px;
            width: 22px;
            height: 22px;
            border-radius: 6px;
            background: var(--accent);
            transform: rotate(45deg);
        }
        ul.points li + li { border-top: 1px solid rgba(255,255,255,0.10); }

        .footer {
            position: absolute;
            left: 110px;
            right: 110px;
            bottom: 54px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 24px;
            letter-spacing: 3px;
            color: rgba(244, 246, 251, 0.55);
            text-transform: uppercase;
        }

        .progress {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 10px;
            background: rgba(255,255,255,0.08);
        }
        .progress .fill {
            height: 100%;
            width: var(--progress);
            background: var(--accent);
            border-radius: 0 6px 6px 0;
            box-shadow: 0 0 24px var(--accent-glow);
        }

        .cta-card {
            display: inline-flex;
            flex-direction: column;
            gap: 26px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.12);
            border-left: 8px solid var(--accent);
            border-radius: 24px;
            padding: 70px 90px;
            max-width: 1300px;
        }
        .cta-card h2 { font-size: 78px; margin: 0; font-weight: 800; }
        .cta-card p { font-size: 36px; margin: 0; color: #b9c2d8; line-height: 1.45; }

        /* ---------- Quiz template: red header, white body, yellow footer ---------- */
        .slide.quiz {
            background: #ffffff;
            color: #000000;
            display: flex;
            flex-direction: column;
            font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', 'Segoe UI', Arial, sans-serif;
        }
        .quiz-header {
            background: #e00000;
            color: #ffe600;
            font-size: 46px;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-align: center;
            padding: 16px 40px;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.85);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .quiz-footer {
            background: #ffe600;
            color: #000000;
            font-size: 42px;
            font-weight: 800;
            text-align: center;
            padding: 14px 40px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .quiz-body {
            position: relative;
            flex: 1;
            padding: 36px 100px 28px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
        }
        .quiz-watermark {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 240px;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.05);
            letter-spacing: 8px;
            user-select: none;
        }
        .quiz-question {
            position: relative;
            font-size: 58px;
            font-weight: 700;
            line-height: 1.35;
            margin-bottom: 34px;
        }
        .quiz-question.medium { font-size: 52px; }
        .quiz-question.small { font-size: 46px; }
        .quiz-question.tiny { font-size: 40px; }
        .quiz-options {
            position: relative;
            list-style: none;
            margin: 0;
            padding: 0;
            display: grid;
            gap: 16px;
        }
        .quiz-option {
            display: flex;
            align-items: baseline;
            gap: 20px;
            font-size: 46px;
            font-weight: 600;
            line-height: 1.3;
            padding: 12px 24px;
            border-radius: 14px;
            background: #f4f6f8;
        }
        .quiz-option .quiz-letter { font-weight: 900; min-width: 60px; }
        .quiz-option .quiz-text.small { font-size: 38px; }
        .quiz-option.correct { background: #16a34a; color: #ffffff; }
        .quiz-option.dim { opacity: 0.4; }
        .quiz-answer-badge {
            position: relative;
            margin-top: 24px;
            font-size: 42px;
            font-weight: 800;
            color: #15803d;
        }
        .quiz-title-headline {
            position: relative;
            font-size: 96px;
            font-weight: 900;
            line-height: 1.2;
        }
        .quiz-title-headline.medium { font-size: 74px; }
        .quiz-title-headline.small { font-size: 58px; }
        .quiz-title-sub {
            position: relative;
            margin-top: 26px;
            font-size: 48px;
            font-weight: 700;
            color: #b91c1c;
        }

        /* Two-column layout for Quiz + Visuals when an answer image is present */
        .quiz-split-container {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 48px;
            width: 100%;
            height: 100%;
        }
        .quiz-left-panel {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .quiz-image-panel {
            width: 520px;
            flex-shrink: 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .quiz-image-frame {
            width: 480px;
            height: 480px;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 16px 40px rgba(0,0,0,0.18), 0 0 0 5px #e00000;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .quiz-image-pic {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .quiz-explanation-badge {
            position: relative;
            margin-top: 18px;
            font-size: 32px;
            font-weight: 600;
            line-height: 1.4;
            color: #1e3a8a;
            background: #f0f7ff;
            border-left: 6px solid #2563eb;
            border-radius: 10px;
            padding: 12px 24px;
        }

        /* ---------- Short Quiz 9:16 Vertical Template (1080x1920) ---------- */
        .slide.quiz-short {
            width: 1080px;
            height: 1920px;
            background: linear-gradient(180deg, #091226 0%, #0d1b3e 50%, #070d1e 100%);
            color: #ffffff;
            display: flex;
            flex-direction: column;
            font-family: 'Nirmala UI', 'Noto Sans Devanagari', 'Mangal', 'Segoe UI', Arial, sans-serif;
            position: absolute;
            inset: 0;
            overflow: hidden;
            opacity: 0;
            visibility: hidden;
        }
        .slide.quiz-short.active {
            opacity: 1;
            visibility: visible;
        }

        .short-header {
            height: 130px;
            background: linear-gradient(90deg, #b91c1c 0%, #dc2626 50%, #b91c1c 100%);
            color: #ffffff;
            padding: 0 35px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 6px 20px rgba(0,0,0,0.5);
            border-bottom: 4px solid #facc15;
            flex-shrink: 0;
            z-index: 10;
        }
        .short-header-left {
            display: flex;
            align-items: center;
            gap: 18px;
        }
        .short-logo-img {
            width: 84px;
            height: 84px;
            border-radius: 50%;
            border: 3px solid #facc15;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            background: #000000;
            object-fit: cover;
        }
        .short-header-title {
            font-size: 38px;
            font-weight: 900;
            color: #ffe600;
            letter-spacing: 0.5px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.9);
        }
        .short-header-badge {
            background: #facc15;
            color: #991b1b;
            font-size: 24px;
            font-weight: 900;
            padding: 8px 18px;
            border-radius: 30px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            letter-spacing: 0.5px;
        }

        /* Compact visual container: occupies ~25% height instead of half screen */
        .short-visual-container {
            width: 960px;
            height: 480px;
            margin: 28px auto 0;
            border-radius: 26px;
            overflow: hidden;
            box-shadow: 0 16px 36px rgba(0,0,0,0.65);
            border: 3px solid rgba(250, 204, 21, 0.45);
            background: #111827;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            position: relative;
        }
        .short-visual-pic {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .short-visual-fallback {
            font-size: 100px;
            color: #ffe600;
        }

        /* Question card prominently positioned in the center */
        .short-question-card {
            width: 960px;
            margin: 32px auto 0;
            background: #ffffff;
            color: #0f172a;
            border-radius: 28px;
            padding: 28px 36px;
            box-shadow: 0 14px 35px rgba(0,0,0,0.45);
            border-left: 12px solid #dc2626;
            display: flex;
            align-items: center;
            gap: 24px;
            flex-shrink: 0;
        }
        .short-q-badge {
            background: #dc2626;
            color: #ffffff;
            font-size: 36px;
            font-weight: 900;
            padding: 12px 24px;
            border-radius: 18px;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
        }
        .short-q-text {
            font-size: 44px;
            font-weight: 800;
            line-height: 1.34;
            color: #0f172a;
            flex: 1;
        }
        .short-q-text.small {
            font-size: 38px;
            line-height: 1.28;
        }

        /* 4 Option Buttons cleanly arranged with ample room */
        .short-options-list {
            width: 960px;
            margin: 30px auto 0;
            display: flex;
            flex-direction: column;
            gap: 22px;
            flex: 1;
            justify-content: flex-start;
        }
        .short-option {
            display: flex;
            align-items: center;
            gap: 24px;
            background: #ffffff;
            color: #1e293b;
            border-radius: 24px;
            padding: 24px 32px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            border: 2px solid transparent;
            transition: all 0.2s;
        }
        .short-option-letter {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: #e2e8f0;
            color: #0f172a;
            font-size: 34px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .short-option-text {
            font-size: 42px;
            font-weight: 700;
            line-height: 1.25;
            color: #1e293b;
            flex: 1;
        }
        .short-option.correct {
            background: linear-gradient(90deg, #15803d 0%, #16a34a 100%) !important;
            color: #ffffff !important;
            border-color: #facc15 !important;
            box-shadow: 0 10px 28px rgba(22, 163, 74, 0.65) !important;
            transform: scale(1.02);
        }
        .short-option.correct .short-option-letter {
            background: #ffffff;
            color: #15803d;
        }
        .short-option.correct .short-option-text {
            color: #ffffff !important;
            font-weight: 900;
        }
        .short-option.dim {
            opacity: 0.4;
        }

        /* Footer bar with Subscribe to ExamIQ Bharat */
        .short-footer-bar {
            height: 104px;
            background: linear-gradient(90deg, #facc15 0%, #ffe600 50%, #facc15 100%);
            color: #000000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 45px;
            box-shadow: 0 -6px 20px rgba(0,0,0,0.4);
            flex-shrink: 0;
            z-index: 10;
        }
        .short-footer-sub-btn {
            background: #dc2626;
            color: #ffffff;
            font-size: 28px;
            font-weight: 900;
            padding: 10px 24px;
            border-radius: 30px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.45);
            letter-spacing: 0.5px;
        }
        .short-footer-tagline {
            font-size: 30px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
        }

        /* ---------- Short Quiz (Clean Reference Match 9:16 Layout) ---------- */
        .slide.quiz-short.clean {
            background: radial-gradient(circle at 50% 18%, #102a6b 0%, #081742 45%, #040a1e 100%);
            padding: 40px 44px 30px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
        }

        /* Ambient background decorative SVG elements */
        .bg-decor {
            position: absolute;
            inset: 0;
            pointer-events: none;
            overflow: hidden;
            z-index: 1;
        }

        .clean-content-layer {
            position: relative;
            z-index: 2;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        /* 1. Top Header */
        .top-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header-brand-group {
            display: flex;
            align-items: center;
            gap: 22px;
        }
        .header-logo-img {
            width: 136px;
            height: 136px;
            border-radius: 50%;
            border: 4px solid #facc15;
            box-shadow: 0 0 28px rgba(250, 204, 21, 0.75);
            background: #000;
            object-fit: cover;
        }
        .header-brand-text {
            display: flex;
            flex-direction: column;
            line-height: 1;
        }
        .brand-examiq {
            font-size: 68px;
            font-weight: 900;
            color: #ffffff;
            letter-spacing: -1px;
            text-shadow: 0 4px 14px rgba(0,0,0,0.9);
        }
        .brand-examiq .gold-iq {
            color: #ffd700;
            font-weight: 900;
        }
        .brand-bharat-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 3px;
        }
        .tri-flag-bar {
            display: inline-block;
            width: 44px;
            height: 8px;
            background: linear-gradient(90deg, #ff9933 33%, #ffffff 33%, #ffffff 66%, #138808 66%);
            border-radius: 4px;
        }
        .brand-bharat-text {
            font-size: 48px;
            font-weight: 900;
            color: #00e676;
            letter-spacing: 0.5px;
            text-shadow: 0 3px 12px rgba(0, 230, 118, 0.5);
        }
        .brand-sub1 {
            margin-top: 8px;
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 2.4px;
            color: #e2e8f0;
            text-shadow: 0 2px 6px rgba(0,0,0,0.8);
        }
        .brand-sub2 {
            margin-top: 5px;
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 1.8px;
            color: #94a3b8;
        }

        .header-slogan-box {
            text-align: right;
            transform: rotate(-3deg);
        }
        .slogan-line1 {
            font-size: 34px;
            font-weight: 900;
            color: #ffffff;
            text-shadow: 0 2px 8px rgba(0,0,0,0.8);
        }
        .slogan-line2 {
            font-size: 36px;
            font-weight: 900;
            color: #ffd700;
            text-shadow: 0 2px 10px rgba(255, 215, 0, 0.6);
            margin-top: 4px;
        }
        .slogan-underline {
            width: 210px;
            height: 8px;
            margin-left: auto;
            margin-top: 6px;
            background: linear-gradient(90deg, #ff9933 0%, #ffffff 50%, #138808 100%);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }

        /* 2. IMPORTANT QUIZ BANNER */
        .important-quiz-bar {
            margin: 14px auto 0;
            width: 860px;
            background: linear-gradient(90deg, #b91c1c 0%, #dc2626 50%, #b91c1c 100%);
            border: 4px solid #facc15;
            border-radius: 24px;
            box-shadow: 0 8px 25px rgba(220, 38, 38, 0.7), 0 0 15px rgba(250, 204, 21, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 12px 0;
            transform: skewX(-4deg);
        }
        .banner-dart {
            font-size: 44px;
            transform: skewX(4deg);
        }
        .banner-text {
            font-size: 52px;
            font-weight: 900;
            font-style: italic;
            color: #ffffff;
            letter-spacing: 2px;
            text-shadow: 3px 3px 0 #7f1d1d, 0 4px 10px rgba(0,0,0,0.8);
            transform: skewX(4deg);
        }

        /* 3. CATEGORY STRIP (NO PART PILL) */
        .cat-part-row {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 20px;
        }
        .subject-pill {
            width: 100%;
            background: linear-gradient(90deg, #ffd700 0%, #facc15 100%);
            border: 4px solid #ffffff;
            border-radius: 50px;
            box-shadow: 0 8px 22px rgba(0,0,0,0.4);
            padding: 12px 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
        }
        .subject-bulb {
            font-size: 40px;
        }
        .subject-text {
            font-size: 38px;
            font-weight: 900;
            color: #000000;
            letter-spacing: 0.5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }


        /* 4. QUESTION CARD - PROMINENT, LARGE, HIGH CTR HOOK */
        .hero-question-card {
            margin-top: 24px;
            background: #ffffff;
            border: 7px solid #facc15;
            border-radius: 40px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(250, 204, 21, 0.45);
            padding: 34px 44px 38px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .card-meta-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .question-badge-pill {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: #ffffff;
            font-size: 32px;
            font-weight: 900;
            padding: 10px 30px;
            border-radius: 16px;
            letter-spacing: 1.2px;
            box-shadow: 0 6px 16px rgba(220, 38, 38, 0.45);
        }
        .target-gk-pill {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 30px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.8px;
        }
        .question-main-text {
            font-size: 64px;
            font-weight: 900;
            line-height: 1.36;
            color: #000000;
            text-align: left;
            letter-spacing: -0.3px;
        }
        .question-main-text.small {
            font-size: 54px;
            line-height: 1.32;
        }
        .question-main-text.tiny {
            font-size: 46px;
            line-height: 1.28;
        }

        /* 5. FOUR STACKED COLORED OPTION BUTTONS */
        .options-container {
            margin-top: 26px;
            display: flex;
            flex-direction: column;
            gap: 22px;
        }
        .option-btn {
            background: #ffffff;
            border-radius: 65px;
            padding: 16px 32px;
            display: flex;
            align-items: center;
            gap: 28px;
            min-height: 124px;
            box-shadow: 0 12px 28px rgba(0,0,0,0.35);
            transition: all 0.25s ease;
        }
        .opt-letter {
            width: 86px;
            height: 86px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 48px;
            font-weight: 900;
            flex-shrink: 0;
            box-shadow: 0 6px 14px rgba(0,0,0,0.3);
        }
        .opt-text {
            font-size: 52px;
            font-weight: 800;
            line-height: 1.25;
            color: #000000;
            flex: 1;
        }

        /* Color schemes matching reference */
        .option-btn.opt-a {
            border: 5px solid #0284c7;
        }
        .option-btn.opt-a .opt-letter {
            background: linear-gradient(135deg, #0284c7, #0369a1);
        }

        .option-btn.opt-b {
            border: 5px solid #dc2626;
        }
        .option-btn.opt-b .opt-letter {
            background: linear-gradient(135deg, #dc2626, #b91c1c);
        }

        .option-btn.opt-c {
            border: 5px solid #16a34a;
        }
        .option-btn.opt-c .opt-letter {
            background: linear-gradient(135deg, #16a34a, #15803d);
        }

        .option-btn.opt-d {
            border: 5px solid #ea580c;
        }
        .option-btn.opt-d .opt-letter {
            background: linear-gradient(135deg, #ea580c, #c2410c);
        }

        /* Answer Reveal State */
        .option-btn.correct {
            background: linear-gradient(90deg, #15803d 0%, #16a34a 100%) !important;
            border-color: #facc15 !important;
            border-width: 5px !important;
            box-shadow: 0 14px 40px rgba(22, 163, 74, 0.75), 0 0 25px rgba(250, 204, 21, 0.6) !important;
            transform: scale(1.02);
        }
        .option-btn.correct .opt-letter {
            background: #ffffff !important;
            color: #15803d !important;
            font-weight: 900 !important;
        }
        .option-btn.correct .opt-text {
            color: #ffffff !important;
            font-weight: 900 !important;
        }
        .option-btn.dim {
            opacity: 0.35 !important;
        }

        /* 6. BOTTOM FOOTER (SUBSCRIBE & LIKE SHARE) */
        .footer-action-area {
            margin-top: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 18px;
            padding-bottom: 12px;
        }
        .subscribe-pill-btn {
            width: 680px;
            height: 98px;
            background: linear-gradient(180deg, #dc2626 0%, #b91c1c 100%);
            border: 4px solid #ffffff;
            border-radius: 60px;
            box-shadow: 0 12px 30px rgba(220, 38, 38, 0.65), 0 0 15px rgba(255, 255, 255, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 22px;
            position: relative;
        }
        .yt-icon-box {
            width: 52px;
            height: 38px;
            background: #ffffff;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #dc2626;
            font-size: 24px;
            padding-left: 3px;
        }
        .sub-bold-text {
            font-size: 46px;
            font-weight: 900;
            color: #ffffff;
            letter-spacing: 2px;
            text-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .bell-icon {
            font-size: 42px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        }
        .hand-pointer {
            position: absolute;
            right: 250px;
            bottom: -32px;
            font-size: 58px;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.7));
            transform: rotate(-10deg);
        }

        .like-share-sub-bar {
            background: linear-gradient(90deg, #facc15 0%, #fde047 50%, #facc15 100%);
            border-radius: 30px;
            padding: 12px 52px;
            color: #000000;
            font-size: 32px;
            font-weight: 900;
            letter-spacing: 3px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 16px;
        }
    </style>
</head>
<body>
    ${slidesHtml}
    <script>
        let currentSlide = 0;
        const slides = document.querySelectorAll('.slide');

        function advanceAnimation() {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }

        window.advanceAnimation = advanceAnimation;
    </script>
</body>
</html>`;
  }

  buildSlideData(script, visualAssets) {
    if (script.quiz?.questions?.length) {
      return this.buildQuizSlideData(script);
    }
    const accentPalette = ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#f472b6', '#60a5fa'];
    const total = 2 + (script.mainContent?.sections?.length || 0);
    const channel = script.metadata?.strategy?.channelName || '';

    const slides = [{
      kind: 'title',
      index: 1,
      total,
      accent: accentPalette[0],
      accentGlow: 'rgba(34, 211, 238, 0.28)',
      image: visualAssets[0] || null,
      channel,
      headline: script.title || '',
      subtitle: this.truncateText(script.hook?.text || '', 180)
    }];

    (script.mainContent?.sections || []).forEach((section, i) => {
      const accent = accentPalette[(i + 1) % accentPalette.length];
      slides.push({
        kind: 'section',
        index: slides.length + 1,
        total,
        accent,
        accentGlow: 'rgba(255,255,255,0.10)',
        image: visualAssets[(i + 1) % Math.max(1, visualAssets.length)] || null,
        channel,
        label: section.title || `Part ${i + 1}`,
        headline: section.onScreen || section.title || '',
        bullets: this.deriveSlideBullets(section)
      });
    });

    slides.push({
      kind: 'cta',
      index: total,
      total,
      accent: accentPalette[1],
      accentGlow: 'rgba(245, 158, 11, 0.25)',
      image: null,
      channel,
      headline: 'Subscribe for more',
      subtitle: this.truncateText(script.callToAction?.subscribe || 'New explainer videos on the channel every week.', 120)
    });

    return slides;
  }

  // Quiz videos use the red-header / white-body / yellow-footer MCQ template:
  // one question slide followed by one answer-reveal slide per question.
  buildQuizSlideData(script) {
    const quiz = script.quiz || {};
    const questions = quiz.questions || [];
    const channel = script.metadata?.strategy?.channelName || script.metadata?.strategy?.channel || '';
    const language = quiz.language === 'en' ? 'en' : 'hi';
    const subject = quiz.subject || 'General Knowledge';
    let subjectHindi = quiz.subjectHindi || quiz.subject || '';
    if (!subjectHindi || subjectHindi.toLowerCase() === 'general knowledge' || subjectHindi === 'gk') {
      const titleToScan = `${script.title || ''} ${script.metadata?.strategy?.topic || ''} ${script.topic || ''}`;
      if (/प्राचीन\s*भारत|ancient\s*india|ancient\s*history/i.test(titleToScan)) subjectHindi = 'प्राचीन भारत का इतिहास';
      else if (/मध्यकालीन|medieval/i.test(titleToScan)) subjectHindi = 'मध्यकालीन भारत का इतिहास';
      else if (/आधुनिक\s*भारत|modern\s*india/i.test(titleToScan)) subjectHindi = 'आधुनिक भारत का इतिहास';
      else if (/इतिहास|history/i.test(titleToScan)) subjectHindi = 'भारत का इतिहास';
      else if (/भूगोल|geography/i.test(titleToScan)) subjectHindi = 'भारत का भूगोल';
      else if (/संविधान|polity|constitution/i.test(titleToScan)) subjectHindi = 'भारतीय संविधान';
      else if (/विज्ञान|science/i.test(titleToScan)) subjectHindi = 'सामान्य विज्ञान GK';
      else if (/अर्थव्यवस्था|economy/i.test(titleToScan)) subjectHindi = 'भारतीय अर्थव्यवस्था';
      else if (/करंट\s*अफेयर्स|current\s*affairs/i.test(titleToScan)) subjectHindi = 'करंट अफेयर्स';
      else subjectHindi = 'सामान्य ज्ञान (GK)';
    }

    const partMatch = (
      String(quiz.part || '') + ' ' +
      String(script.partNumber || '') + ' ' +
      String(script.title || '') + ' ' +
      String(script.metadata?.strategy?.topic || '') + ' ' +
      String(script.metadata?.strategy?.context || '') + ' ' +
      String(script.metadata?.rawRequest || '')
    ).match(/(?:part|भाग)\s*[:#-]?\s*(\d+)/i);
    const partNumber = partMatch ? partMatch[1] : (quiz.part || script.partNumber || '1');

    const isShort = Boolean(
      script.isShort ||
      script.quiz?.isShort ||
      String(script.metadata?.strategy?.contentType || '').toLowerCase() === 'quiz_short' ||
      String(script.metadata?.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short' ||
      String(script.metadata?.strategy?.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
      String(script.metadata?.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short_no_image'
    );
    const activeQuestions = isShort ? questions.slice(0, 5) : questions;
    const actualCount = activeQuestions.length;
    const isExplicitVisuals = Boolean(
      script.quizVisuals ||
      String(script.metadata?.strategy?.contentType || '').toLowerCase() === 'quiz_visuals' ||
      String(script.metadata?.strategy?.requestedStyle || '').toLowerCase() === 'quiz_visuals'
    );
    // User mandate: Shorts MUST STRICTLY use the clean structured ExamIQ typography layout (shortQuizCleanQuestion)
    // without background AI images.
    const isNoImageShort = Boolean(isShort && !isExplicitVisuals);
    const header = isShort
      ? '🔴 EXAMIQ BHARAT GK QUIZ'
      : (quiz.headerLabel || `Top ${actualCount} ${subject} Question and answer`);
    const footer = channel
      ? (language === 'en' ? `Subscribe to ${channel}` : `${channel} को सब्सक्राइब करें`)
      : (language === 'en' ? 'Subscribe for more quizzes' : 'चैनल को सब्सक्राइब करें');
    const watermark = subjectHindi || subject || 'GK';
    const total = isShort ? (actualCount * 2) : (1 + actualCount * 2);
    const slides = [];

    // Preload channel logo as base64 data URI if available
    let channelLogoUri = null;
    try {
      const logoPath = path.join(__dirname, '..', 'assets', 'channel_logo.png');
      if (require('fs').existsSync(logoPath)) {
        const logoBuf = require('fs').readFileSync(logoPath);
        channelLogoUri = `data:image/png;base64,${logoBuf.toString('base64')}`;
      }
    } catch (_logoErr) {}

    // Title slide at video start (only for long-form quiz, not for rapid-fire Shorts)
    if (!isShort) {
      const introText = script.hook?.text || introNarration(subjectHindi, actualCount, language);
      slides.push({
        kind: 'quizTitle',
        index: 1,
        total,
        header,
        footer,
        watermark,
        channel,
        language,
        headline: script.title || header,
        questionCount: actualCount,
        narrationText: introText,
        pauseAfter: 0.8,
        estimatedSpeechDuration: Math.max(3.0, estimateSpeechDuration(introText, language)),
        narrationWords: Math.max(4, wordCount(introText))
      });
    }

    activeQuestions.forEach((question, index) => {
      let imageUri = null;
      if (!isNoImageShort && question.visualImage && typeof question.visualImage === 'string') {
        const isInfoOrSim = question.visualImage.endsWith('.info') || question.visualImage.includes('_sim_');
        const isDataImage = question.visualImage.startsWith('data:image/');
        const ext = path.extname(question.visualImage).toLowerCase().replace('.', '');
        const isValidImageExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

        if (!isInfoOrSim) {
          if (isDataImage) {
            imageUri = question.visualImage;
          } else if (isValidImageExt) {
            try {
              const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
              const buf = require('fs').readFileSync(question.visualImage);
              imageUri = `data:${mime};base64,${buf.toString('base64')}`;
            } catch (_e) {
              imageUri = null;
            }
          }
        }
      }

      if (isShort) {
        // Rapid-fire Short question & answer: if no real AI image was produced, use clean reference layout
        const useCleanTemplate = isNoImageShort || !imageUri;
        const qText = shortQuestionNarration(question, language);
        const aText = shortAnswerNarration(question, language);
        slides.push({
          kind: useCleanTemplate ? 'shortQuizCleanQuestion' : 'shortQuizQuestion',
          index: slides.length + 1,
          total,
          header,
          footer,
          watermark,
          channel,
          channelLogo: channelLogoUri,
          language,
          question,
          totalQuestions: actualCount,
          subjectHindi,
          partNumber,
          noImages: useCleanTemplate,
          image: imageUri,
          narrationText: qText,
          pauseAfter: 0.3,
          estimatedSpeechDuration: Math.max(1.8, estimateSpeechDuration(qText, language)),
          narrationWords: Math.max(3, wordCount(qText))
        });
        slides.push({
          kind: useCleanTemplate ? 'shortQuizCleanAnswer' : 'shortQuizAnswer',
          index: slides.length + 1,
          total,
          header,
          footer,
          watermark,
          channel,
          channelLogo: channelLogoUri,
          language,
          question,
          totalQuestions: actualCount,
          subjectHindi,
          partNumber,
          noImages: useCleanTemplate,
          image: imageUri,
          narrationText: aText,
          pauseAfter: 0.3,
          estimatedSpeechDuration: Math.max(1.2, estimateSpeechDuration(aText, language)),
          narrationWords: Math.max(2, wordCount(aText))
        });
      } else {
        const qText = questionNarration(question, language, index, questions.length);
        const aText = answerNarration(question, language);

        slides.push({
          kind: 'quizQuestion',
          index: slides.length + 1,
          total,
          header,
          footer,
          watermark,
          channel,
          language,
          question,
          image: null,
          narrationText: qText,
          pauseAfter: 1.2,
          estimatedSpeechDuration: Math.max(3.0, estimateSpeechDuration(qText, language)),
          narrationWords: Math.max(4, wordCount(qText))
        });
        slides.push({
          kind: 'quizAnswer',
          index: slides.length + 1,
          total,
          header,
          footer,
          watermark,
          channel,
          language,
          question,
          image: imageUri,
          narrationText: aText,
          pauseAfter: 0.8,
          estimatedSpeechDuration: Math.max(2.0, estimateSpeechDuration(aText, language)),
          narrationWords: Math.max(3, wordCount(aText))
        });
      }
    });

    return slides;
  }

  // Generates per-slide narration audio segments and stitches them into a seamless
  // master audio track with exact per-slide duration tracking. Uses uncompressed PCM WAV
  // for segment concatenation to prevent MP3 encoder delay padding and cumulative drift.
  async generateQuizAudio(script, audioPath, options = {}) {
    this.logger.info('Generating slide-synchronized quiz narration audio...');
    const slides = this.buildQuizSlideData(script);
    const audioDir = path.dirname(audioPath);
    await fs.mkdir(audioDir, { recursive: true });

    const tempDir = path.join(audioDir, `temp_quiz_audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(tempDir, { recursive: true });

    const sceneDir = options.productionId
      ? path.join(path.resolve(__dirname, '..', 'data', 'audio', 'scenes'), options.productionId)
      : null;
    if (sceneDir) {
      await fs.mkdir(sceneDir, { recursive: true });
    }

    const durations = [];
    const paddedWavFiles = [];

    try {
      // Sequential synthesis prevents concurrent bursts from hitting Gemini free-tier RPM limits
      const concurrency = 1;
      const results = new Array(slides.length);

      for (let i = 0; i < slides.length; i += concurrency) {
        if (i > 0) {
          // 800ms pacing prevents hitting Gemini free-tier RPM limits
          await new Promise(r => setTimeout(r, 800));
        }
        const batch = [];
        for (let j = i; j < Math.min(i + concurrency, slides.length); j++) {
          batch.push((async (index) => {
            const slide = slides[index];
            const text = String(slide.narrationText || '').trim();
            const rawPath = path.join(tempDir, `raw_${String(index).padStart(3, '0')}.mp3`);
            const rawWavPath = path.join(tempDir, `raw_${String(index).padStart(3, '0')}.wav`);
            const paddedWavPath = path.join(tempDir, `padded_${String(index).padStart(3, '0')}.wav`);
            const pause = Number(slide.pauseAfter) || 0.5;

            let hasAudio = false;
            if (text) {
              try {
                const resPath = await this.generateTTSAudio(text, rawPath);
                hasAudio = await this.isUsableAudioFile(resPath);
              } catch (err) {
                this.logger.warn(`Slide ${index} TTS failed (${err.message}); using fallback silence`);
              }
            }

            if (!hasAudio) {
              const fallbackDur = Math.max(2.0, Number(slide.estimatedSpeechDuration) || 4.0);
              await runFFmpeg([
                '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
                '-t', fallbackDur.toFixed(2),
                '-c:a', 'pcm_s16le',
                rawWavPath
              ]);
            } else {
              // Convert raw TTS output to normalized 24kHz mono PCM WAV
              try {
                await runFFmpeg([
                  '-y', '-i', rawPath,
                  '-ar', '24000', '-ac', '1',
                  '-c:a', 'pcm_s16le',
                  rawWavPath
                ]);
              } catch (convErr) {
                this.logger.warn(`Slide ${index} audio conversion failed (${convErr.message}); using fallback silence`);
                const fallbackDur = Math.max(2.0, Number(slide.estimatedSpeechDuration) || 4.0);
                await runFFmpeg([
                  '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
                  '-t', fallbackDur.toFixed(2),
                  '-c:a', 'pcm_s16le',
                  rawWavPath
                ]);
              }
            }

            // Append exact pause padding to uncompressed PCM WAV segment
            await runFFmpeg([
              '-y', '-i', rawWavPath,
              '-af', `apad=pad_dur=${pause.toFixed(3)}`,
              '-ar', '24000', '-ac', '1',
              '-c:a', 'pcm_s16le',
              paddedWavPath
            ]);

            const dur = await this.getMediaDuration(paddedWavPath);
            results[index] = { index, paddedWavPath, dur };

            if (sceneDir) {
              const scenePath = path.join(sceneDir, `${String(index).padStart(3, '0')}_r1.mp3`);
              await runFFmpeg([
                '-y', '-i', paddedWavPath,
                '-ar', '24000', '-ac', '1',
                '-c:a', 'libmp3lame', '-b:a', '128k',
                scenePath
              ]).catch(() => {});
            }
          })(j));
        }
        await Promise.all(batch);
      }

      for (let i = 0; i < slides.length; i++) {
        const res = results[i];
        durations.push(res.dur);
        paddedWavFiles.push(res.paddedWavPath);
      }

      // Concat all padded WAV segments into master WAV (sample-exact, zero lossy gap)
      // Use absolute path so FFmpeg concat never fails when audioPath is a relative path
      const concatListPath = path.join(tempDir, 'concat_list.txt');
      const concatContent = paddedWavFiles
        .map(f => `file '${path.resolve(f).replace(/\\/g, '/')}'`)
        .join('\n');
      await fs.writeFile(concatListPath, concatContent, 'utf8');

      const masterWavPath = path.join(tempDir, 'master.wav');
      await runFFmpeg([
        '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
        '-c:a', 'pcm_s16le',
        masterWavPath
      ]);

      // Encode master WAV to target MP3 container
      await runFFmpeg([
        '-y', '-i', masterWavPath,
        '-ar', '24000', '-ac', '1',
        '-c:a', 'libmp3lame', '-b:a', '192k',
        audioPath
      ]);

      let exactDurations = durations.map(d => Number(d.toFixed(3)));
      let totalDur = exactDurations.reduce((sum, d) => sum + d, 0);

      // Algorithmic hard cap: YouTube Shorts MUST NOT exceed 42s for peak audience retention
      const isShortQuiz = slides.some(s => s.kind && s.kind.startsWith('shortQuiz'));
      if (isShortQuiz && totalDur > 42.0) {
        const speedFactor = Math.min(1.5, Number((totalDur / 40.0).toFixed(3)));
        this.logger.info(`Shorts audio duration (${totalDur.toFixed(2)}s) exceeds 42s; scaling tempo by ${speedFactor}x for retention`);
        const spedUpPath = path.join(tempDir, 'master_sped.mp3');
        await runFFmpeg([
          '-y', '-i', audioPath,
          '-filter:a', `atempo=${speedFactor}`,
          '-c:a', 'libmp3lame', '-b:a', '192k',
          spedUpPath
        ]);
        await fs.copyFile(spedUpPath, audioPath);
        exactDurations = exactDurations.map(d => Number((d / speedFactor).toFixed(3)));
        totalDur = exactDurations.reduce((sum, d) => sum + d, 0);
      }

      // Save durations sidecar file
      const durationsPath = audioPath.replace(/\.mp3$/i, '_durations.json');
      await fs.writeFile(durationsPath, JSON.stringify({
        durations: exactDurations,
        totalDuration: Number(totalDur.toFixed(3)),
        count: exactDurations.length,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');

      this.lastQuizSlideDurations = exactDurations;
      this.logger.info(`Quiz audio generated successfully (${exactDurations.length} slides, ${totalDur.toFixed(2)}s)`);

      return {
        audioPath,
        slideDurations: exactDurations,
        durationsPath
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Resolves slide durations for quiz videos. When explicit durations are available
  // (from generateQuizAudio, a durations sidecar file, or pre-rendered scenes), they
  // are returned directly to guarantee 100% voice-to-slide synchronization.
  async resolveQuizSlideDurations(slides, totalDuration, audioPath = null, options = {}) {
    if (Array.isArray(options.durations) && options.durations.length === slides.length) {
      return options.durations.map(Number);
    }
    if (Array.isArray(options.slideDurations) && options.slideDurations.length === slides.length) {
      return options.slideDurations.map(Number);
    }
    if (Array.isArray(this.lastQuizSlideDurations) && this.lastQuizSlideDurations.length === slides.length) {
      return this.lastQuizSlideDurations.map(Number);
    }

    if (audioPath && typeof audioPath === 'string') {
      const sidecarPath = audioPath.replace(/\.mp3$/i, '_durations.json');
      try {
        const raw = await fs.readFile(sidecarPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.durations) && parsed.durations.length === slides.length) {
          return parsed.durations.map(Number);
        }
      } catch (_err) {}
    }

    if (options.productionId) {
      const sceneDir = path.join(path.resolve(__dirname, '..', 'data', 'audio', 'scenes'), options.productionId);
      try {
        const sceneDurations = [];
        for (let i = 0; i < slides.length; i++) {
          const sceneFile = path.join(sceneDir, `${String(i).padStart(3, '0')}_r1.mp3`);
          const dur = await this.getMediaDuration(sceneFile);
          sceneDurations.push(dur);
        }
        if (sceneDurations.length === slides.length && sceneDurations.every(d => Number.isFinite(d) && d > 0)) {
          return sceneDurations;
        }
      } catch (_err) {}
    }

    const weights = slides.map(slide => Math.max(1.0, Number(slide.estimatedSpeechDuration) || Number(slide.narrationWords) * 0.48 || 1));
    const weighted = weights.reduce((sum, weight) => sum + weight, 0);
    if (!weighted || !Number.isFinite(totalDuration) || totalDuration <= 0) {
      return slides.map(() => Math.max(2, totalDuration / Math.max(1, slides.length)));
    }
    const scaled = weights.map(weight => Math.max(1.5, (weight / weighted) * totalDuration));
    const scale = totalDuration / scaled.reduce((sum, value) => sum + value, 0);
    return scaled.map(value => value * scale);
  }

  renderSlideHtml(slide) {
    if (slide.kind === 'shortQuizCleanQuestion' || slide.kind === 'shortQuizCleanAnswer' || (String(slide.kind || '').startsWith('shortQuiz') && slide.noImages)) {
      return this.renderShortQuizCleanSlideHtml(slide);
    }
    if (String(slide.kind || '').startsWith('shortQuiz')) {
      return this.renderShortQuizSlideHtml(slide);
    }
    if (String(slide.kind || '').startsWith('quiz')) {
      return this.renderQuizSlideHtml(slide);
    }
    const image = slide.image
      ? `<img class="bg-image" src="${slide.image}" />`
      : '';
    const scrim = slide.image ? '<div class="scrim"></div><div class="scrim-bottom"></div>' : '';
    const channel = this.escapeHtml(slide.channel || '');

    if (slide.kind === 'title') {
      return `
    <div class="slide active" style="--accent: ${slide.accent}; --accent-glow: ${slide.accentGlow}; --progress: ${(slide.index / slide.total * 100).toFixed(1)}%">
        ${image}${scrim}
        <div class="frame">
            <div class="kicker"><span class="line"></span>Today's topic</div>
            <h1 class="${slide.headline.length > 48 ? 'medium' : ''}">${this.escapeHtml(this.truncateText(slide.headline, 90))}</h1>
            <p class="subtitle">${this.escapeHtml(slide.subtitle)}</p>
        </div>
        <div class="footer"><span>${channel}</span><span>01 / ${String(slide.total).padStart(2, '0')}</span></div>
        <div class="progress"><div class="fill"></div></div>
    </div>`;
    }

    if (slide.kind === 'cta') {
      return `
    <div class="slide" style="--accent: ${slide.accent}; --accent-glow: ${slide.accentGlow}; --progress: 100%">
        ${image}${scrim}
        <div class="frame">
            <div class="cta-card">
                <h2>✅ ${this.escapeHtml(slide.headline)}</h2>
                <p>${this.escapeHtml(slide.subtitle)}</p>
            </div>
        </div>
        <div class="footer"><span>${channel}</span><span>${String(slide.index).padStart(2, '0')} / ${String(slide.total).padStart(2, '0')}</span></div>
        <div class="progress"><div class="fill"></div></div>
    </div>`;
    }

    const headline = this.escapeHtml(this.truncateText(slide.headline, 70));
    const headlineClass = slide.headline.length > 48 ? 'medium' : (slide.headline.length > 30 ? 'small' : '');
    const bullets = slide.bullets.length
      ? `<ul class="points">${slide.bullets.map(b => `<li>${this.escapeHtml(b)}</li>`).join('')}</ul>`
      : '';
    return `
    <div class="slide" style="--accent: ${slide.accent}; --accent-glow: ${slide.accentGlow}; --progress: ${(slide.index / slide.total * 100).toFixed(1)}%">
        ${image}${scrim}
        <div class="frame">
            <div class="kicker"><span class="line"></span>${this.escapeHtml(this.truncateText(slide.label, 40))}</div>
            <h1 class="${headlineClass}">${headline}</h1>
            ${bullets}
        </div>
        <div class="footer"><span>${channel}</span><span>${String(slide.index).padStart(2, '0')} / ${String(slide.total).padStart(2, '0')}</span></div>
        <div class="progress"><div class="fill"></div></div>
    </div>`;
  }

  // Red-header / white-body / yellow-footer MCQ slides, matching the popular
  // Hindi exam-quiz channel format.
  renderQuizSlideHtml(slide) {
    const language = slide.language === 'en' ? 'en' : 'hi';
    const active = (slide.kind === 'quizTitle' || slide.index === 1) ? ' active' : '';
    const header = `<div class="quiz-header">${this.escapeHtml(slide.header)}</div>`;
    const footer = `<div class="quiz-footer">${this.escapeHtml(slide.footer)}</div>`;
    const watermark = slide.watermark
      ? `<div class="quiz-watermark">${this.escapeHtml(slide.watermark)}</div>`
      : '';

    if (slide.kind === 'quizTitle') {
      const headlineClass = slide.headline.length > 60 ? 'small' : (slide.headline.length > 36 ? 'medium' : '');
      return `
    <div class="slide quiz${active}">
        ${header}
        <div class="quiz-body">
            ${watermark}
            <div class="quiz-title-headline ${headlineClass}">${this.escapeHtml(slide.headline)}</div>
            <div class="quiz-title-sub">${language === 'en' ? `${slide.questionCount} questions` : `${slide.questionCount} प्रश्न`} &middot; GK Quiz</div>
        </div>
        ${footer}
    </div>`;
    }

    if (slide.kind === 'quizCta') {
      return `
    <div class="slide quiz">
        ${header}
        <div class="quiz-body">
            ${watermark}
            <div class="quiz-title-headline medium">${this.escapeHtml(slide.headline)}</div>
            <div class="quiz-title-sub">${this.escapeHtml(this.truncateText(slide.subtitle || '', 90))}</div>
        </div>
        ${footer}
    </div>`;
    }

    const question = slide.question || {};
    const questionText = `${question.number}. ${question.question || ''}`;
    const questionClass = questionText.length > 150 ? 'tiny' : (questionText.length > 100 ? 'small' : (questionText.length > 60 ? 'medium' : ''));
    const isAnswer = slide.kind === 'quizAnswer';
    const answerIndex = Number.isInteger(question.answerIndex) ? question.answerIndex : -1;

    const options = (question.options || []).map((option, index) => {
      const classes = ['quiz-option'];
      if (isAnswer && index === answerIndex) classes.push('correct');
      if (isAnswer && index !== answerIndex) classes.push('dim');
      const optionClass = option.length > 48 ? 'small' : '';
      return `        <li class="${classes.join(' ')}"><span class="quiz-letter">${LETTERS[index]}.</span><span class="quiz-text ${optionClass}">${this.escapeHtml(option)}</span></li>`;
    }).join('\n');

    const badge = isAnswer && answerIndex >= 0
      ? `<div class="quiz-answer-badge">&#10004; ${language === 'en' ? 'Answer' : 'सही उत्तर'}: ${LETTERS[answerIndex]}) ${this.escapeHtml(this.truncateText((question.options || [])[answerIndex] || '', 60))}</div>`
      : '';

    const explanationBadge = isAnswer && question.explanation
      ? `<div class="quiz-explanation-badge"><span class="quiz-fact-icon">💡 </span>${this.escapeHtml(this.truncateText(question.explanation, 140))}</div>`
      : '';

    const hasImage = Boolean(slide.image);
    const content = hasImage
      ? `<div class="quiz-split-container">
            <div class="quiz-left-panel">
                <div class="quiz-question ${questionClass}">${this.escapeHtml(questionText)}</div>
                <ul class="quiz-options">
${options}
                </ul>
                ${badge}
                ${explanationBadge}
            </div>
            <div class="quiz-image-panel">
                <div class="quiz-image-frame">
                    <img src="${slide.image}" class="quiz-image-pic" alt="Answer visual" />
                </div>
            </div>
        </div>`
      : `<div class="quiz-question ${questionClass}">${this.escapeHtml(questionText)}</div>
            <ul class="quiz-options">
${options}
            </ul>
            ${badge}
            ${explanationBadge}`;

    return `
    <div class="slide quiz${active}">
        ${header}
        <div class="quiz-body">
            ${watermark}
            ${content}
        </div>
        ${footer}
    </div>`;
  }

  // 9:16 Vertical Short Quiz slide template (1080x1920)
  renderShortQuizSlideHtml(slide) {
    const question = slide.question || {};
    const isAnswer = slide.kind === 'shortQuizAnswer';
    const active = slide.index === 1 ? ' active' : '';
    const answerIndex = Number.isInteger(question.answerIndex) ? question.answerIndex : -1;

    const visualHtml = slide.image
      ? `<img src="${slide.image}" class="short-visual-pic" alt="Topic visual" />`
      : `<div class="short-visual-fallback">🎯</div>`;

    const optionsHtml = (question.options || []).map((option, index) => {
      const classes = ['short-option'];
      if (isAnswer && index === answerIndex) classes.push('correct');
      if (isAnswer && index !== answerIndex) classes.push('dim');
      const letter = LETTERS[index] || 'A';
      const checkMark = (isAnswer && index === answerIndex) ? ' ✓' : '';
      return `        <div class="${classes.join(' ')}">
            <span class="short-option-letter">${letter}</span>
            <span class="short-option-text">${this.escapeHtml(option)}${checkMark}</span>
        </div>`;
    }).join('\n');

    const logoHtml = slide.channelLogo
      ? `<img src="${slide.channelLogo}" class="short-logo-img" alt="ExamIQ Bharat Logo" />`
      : `<span style="font-size: 54px;">🎓</span>`;

    const questionText = question.question || '';
    const qTextClass = questionText.length > 80 ? 'small' : '';

    return `
    <div class="slide quiz-short${active}">
        <div class="short-header">
            <div class="short-header-left">
                ${logoHtml}
                <div class="short-header-title">ExamIQ Bharat</div>
            </div>
            <div class="short-header-badge">GK QUIZ</div>
        </div>
        <div class="short-visual-container">
            ${visualHtml}
        </div>
        <div class="short-question-card">
            <div class="short-q-badge">Q.${question.number || 1}</div>
            <div class="short-q-text ${qTextClass}">${this.escapeHtml(questionText)}</div>
        </div>
        <div class="short-options-list">
${optionsHtml}
        </div>
        <div class="short-footer-bar">
            <div class="short-footer-tagline">⚡ RAPID FIRE QUIZ</div>
            <div class="short-footer-sub-btn">🔔 Subscribe to ExamIQ Bharat</div>
        </div>
    </div>`;
  }

  // 9:16 Vertical Short Quiz Clean Structured Typography template (Without Images) (1080x1920)
  renderShortQuizCleanSlideHtml(slide) {
    const question = slide.question || {};
    const isAnswer = slide.kind === 'shortQuizCleanAnswer' || slide.kind === 'shortQuizAnswer';
    const active = slide.index === 1 ? ' active' : '';
    const answerIndex = Number.isInteger(question.answerIndex) ? question.answerIndex : -1;
    const subjectHindi = slide.subjectHindi || 'सामान्य ज्ञान (GK)';

    const optionsHtml = (question.options || []).map((option, index) => {
      const optLetter = LETTERS[index] || 'A';
      const optClassLetter = optLetter.toLowerCase();
      const classes = ['option-btn', `opt-${optClassLetter}`];
      if (isAnswer && index === answerIndex) classes.push('correct');
      if (isAnswer && index !== answerIndex) classes.push('dim');
      const checkMark = (isAnswer && index === answerIndex) ? ' ✓' : '';
      return `                <div class="${classes.join(' ')}">
                    <div class="opt-letter">${optLetter}</div>
                    <div class="opt-text">${this.escapeHtml(option)}${checkMark}</div>
                </div>`;
    }).join('\n');

    const logoHtml = slide.channelLogo
      ? `<img src="${slide.channelLogo}" class="header-logo-img" alt="ExamIQ Logo" />`
      : `<div class="header-logo-img" style="display:flex;align-items:center;justify-content:center;font-size:60px;">🎓</div>`;

    const questionText = question.question || '';
    let qTextClass = '';
    if (questionText.length > 135) qTextClass = 'tiny';
    else if (questionText.length > 95) qTextClass = 'small';

    return `
    <div class="slide quiz-short clean${active}">
        <!-- Ambient thematic SVGs -->
        <svg class="bg-decor" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- India map silhouette top-left -->
            <path d="M40 240 C80 220, 160 230, 200 280 C250 330, 230 380, 270 420 C300 440, 280 500, 240 540 C190 600, 140 620, 80 570 C40 510, 20 420, 30 350 Z" stroke="#00e5ff" stroke-width="2.5" fill="url(#mapGrad)" opacity="0.18"/>
            <!-- Parliament building dome top-right -->
            <path d="M800 460 L1050 460 L1050 390 C1050 330, 800 330, 800 390 Z" stroke="#ffd700" stroke-width="3" fill="none" opacity="0.22"/>
            <path d="M925 330 L925 285 M925 285 L955 296 L925 307" stroke="#ff9933" stroke-width="3" fill="#ff9933" opacity="0.35"/>
            <!-- Book neon icon middle-left -->
            <g transform="translate(35, 1080)" stroke="#00e5ff" stroke-width="3" fill="none" opacity="0.32">
                <path d="M10 20 C35 10, 60 20, 60 20 L60 80 C60 80, 35 70, 10 80 Z"/>
                <path d="M110 20 C85 10, 60 20, 60 20 L60 80 C60 80, 85 70, 110 80 Z"/>
                <line x1="60" y1="20" x2="60" y2="80"/>
            </g>
            <!-- Pillar icon middle-right -->
            <g transform="translate(930, 1100)" stroke="#00e5ff" stroke-width="3" fill="none" opacity="0.32">
                <rect x="10" y="10" width="70" height="12" rx="3"/>
                <line x1="24" y1="22" x2="24" y2="85"/>
                <line x1="45" y1="22" x2="45" y2="85"/>
                <line x1="66" y1="22" x2="66" y2="85"/>
                <rect x="10" y="85" width="70" height="12" rx="3"/>
            </g>
            <!-- Ancient Monument silhouette bottom-left -->
            <g transform="translate(35, 1380)" fill="#f59e0b" opacity="0.18">
                <rect x="10" y="160" width="200" height="45" rx="4"/>
                <rect x="25" y="115" width="170" height="45" rx="4"/>
                <rect x="50" y="70" width="120" height="45" rx="4"/>
                <rect x="80" y="25" width="60" height="45" rx="4"/>
            </g>
            <!-- Buddha statue silhouette bottom-right -->
            <g transform="translate(840, 1340)" stroke="#38bdf8" stroke-width="3" fill="none" opacity="0.25">
                <circle cx="105" cy="55" r="32"/>
                <path d="M75 85 C55 115, 45 170, 45 210 L165 210 C165 170, 155 115, 135 85 Z"/>
                <path d="M30 210 C45 235, 165 235, 180 210 Z"/>
            </g>
            <defs>
                <linearGradient id="mapGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
                </linearGradient>
            </defs>
        </svg>

        <div class="clean-content-layer">
            <!-- 1. Top Header -->
            <div class="top-header">
                <div class="header-brand-group">
                    ${logoHtml}
                    <div class="header-brand-text">
                        <div class="brand-examiq">Exam<span class="gold-iq">IQ</span></div>
                        <div class="brand-bharat-row">
                            <span class="tri-flag-bar"></span>
                            <span class="brand-bharat-text">Bharat</span>
                            <span class="tri-flag-bar"></span>
                        </div>
                        <div class="brand-sub1">GK | REASONING | MATHS</div>
                        <div class="brand-sub2">FOR GOVERNMENT EXAMS</div>
                    </div>
                </div>
                <div class="header-slogan-box">
                    <div class="slogan-line1">सही तैयारी</div>
                    <div class="slogan-line2">सफलता की गारंटी</div>
                    <div class="slogan-underline"></div>
                </div>
            </div>

            <!-- 2. Important Quiz Banner -->
            <div class="important-quiz-bar">
                <span class="banner-dart">🎯</span>
                <span class="banner-text">IMPORTANT QUIZ</span>
            </div>

            <!-- 3. Category Strip -->
            <div class="cat-part-row">
                <div class="subject-pill">
                    <span class="subject-bulb">💡</span>
                    <span class="subject-text">${this.escapeHtml(subjectHindi)}</span>
                </div>
            </div>

            <!-- 4. Hero Question Card -->
            <div class="hero-question-card">
                <div class="card-meta-top">
                    <div class="question-badge-pill">QUESTION ${question.number || 1}</div>
                    <div class="target-gk-pill">🎯 TARGET GK</div>
                </div>
                <div class="question-main-text ${qTextClass}">
                    ${this.escapeHtml(questionText)}
                </div>
            </div>

            <!-- 5. Four Colored Option Buttons -->
            <div class="options-container">
${optionsHtml}
            </div>

            <!-- 6. Footer CTA Area -->
            <div class="footer-action-area">
                <div class="subscribe-pill-btn">
                    <div class="yt-icon-box">▶</div>
                    <div class="sub-bold-text">SUBSCRIBE</div>
                    <div class="bell-icon">🔔</div>
                    <div class="hand-pointer">👆</div>
                </div>
                <div class="like-share-sub-bar">
                    LIKE &nbsp;|&nbsp; SHARE &nbsp;|&nbsp; SUBSCRIBE
                </div>
            </div>
        </div>
    </div>`;
  }

  calculateScriptDuration(script) {
    // Estimate duration based on word count (average 150 words per minute)
    let totalWords = 0;
    if (script.hook) totalWords += script.hook.text.split(' ').length;
    if (script.introduction) {
      totalWords += (script.introduction.greeting || '').split(' ').length;
      totalWords += (script.introduction.topicIntro || '').split(' ').length;
    }
    
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        if (typeof section.content === 'string') {
          totalWords += section.content.split(' ').length;
        }
        if (section.items) {
          section.items.forEach(item => {
            totalWords += (item.title + ' ' + item.description).split(' ').length;
          });
        }
        if (section.steps) {
          section.steps.forEach(step => {
            totalWords += (step.title + ' ' + step.description).split(' ').length;
          });
        }
      });
    }
    
    if (script.conclusion) {
      totalWords += script.conclusion.finalThought.split(' ').length;
    }
    
    // Convert to duration (150 words per minute)
    return Math.max(30, Math.ceil((totalWords / 150) * 60));
  }

  async addAudioToVideo(videoPath, audioPath, outputPath, options = {}) {
    const hasRealAudio = await this.isUsableAudioFile(audioPath);

    if (!hasRealAudio) {
      if (options.allowSilent === true) {
        this.logger.warn('Creating an intentionally silent video from an operator-confirmed override.');
        if (videoPath !== outputPath) await fs.copyFile(videoPath, outputPath);
        return outputPath;
      }
      const error = new Error('Narration audio is required. Regenerate narration or explicitly confirm an intentional silent video.');
      error.code = 'NARRATION_REQUIRED';
      throw error;
    }

    // FFmpeg cannot write to its own input, so mux to a temp file when paths collide
    const muxPath = outputPath === videoPath
      ? outputPath.replace(/\.mp4$/i, '_muxed.mp4')
      : outputPath;

    const videoInput = options.loopVideo ? ['-stream_loop', '-1', '-i', videoPath] : ['-i', videoPath];
    await runFFmpeg(['-y', ...videoInput, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-shortest', muxPath]);

    if (muxPath !== outputPath) {
      await fs.rename(muxPath, outputPath);
    }

    this.logger.info('Audio added to video successfully');
    return outputPath;
  }

  async isUsableAudioFile(audioPath) {
    if (typeof audioPath !== 'string' || audioPath.endsWith('.info')) {
      return false;
    }

    try {
      const stats = await fs.stat(audioPath);
      if (!stats.isFile() || stats.size < 300) {
        return false;
      }
      // Check first 16 bytes: legitimate audio should not start with JSON '{' or HTML '<'
      const fd = await fs.open(audioPath, 'r');
      const buf = Buffer.alloc(16);
      await fd.read(buf, 0, 16, 0);
      await fd.close();
      const head = buf.toString('utf8').trim();
      if (head.startsWith('{') || head.startsWith('<')) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async downloadVideo(url, outputPath) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        await fs.unlink(path.join(dirPath, file));
      }
      await fs.rmdir(dirPath);
    } catch (error) {
      this.logger.warn('Cleanup failed:', error.message);
    }
  }

  async generateThumbnail(script, style = "ethereal") {
    this.logger.info('Generating custom thumbnail...');

    try {
      if (!this.openai && !this.gemini && !this.pollinationsClient) {
        return await this.simulateThumbnailGeneration(script, style);
      }

      const prompt = `YouTube thumbnail for "${script.title}", ${style} style, eye-catching, high contrast text, professional design, clickable, engaging`;
      const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `thumbnail_${Date.now()}.png`);

      await this.generateImage(prompt, thumbnailPath);
      const metadata = await sharp(thumbnailPath).metadata();

      return {
        path: thumbnailPath,
        dimensions: { width: metadata.width, height: metadata.height },
        fileSize: await this.getFileSize(thumbnailPath)
      };
    } catch (error) {
      this.logger.error('Thumbnail generation failed:', error);
      return await this.simulateThumbnailGeneration(script, style);
    }
  }

  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  // Simulation methods for when APIs are not available
  async simulateTTSGeneration(text, outputPath) {
    this.logger.info('Simulating TTS generation...');
    
    const infoPath = outputPath + '.info';
    await fs.writeFile(infoPath, JSON.stringify({
      message: 'AI TTS audio would be generated here',
      text: text.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    }, null, 2));
    
    return infoPath;
  }

  async simulateVisualAssets(prompt, style, count) {
    this.logger.info(`Simulating ${count} visual assets...`);
    
    const paths = [];
    for (let i = 0; i < count; i++) {
      const assetPath = path.join(__dirname, '..', 'data', 'assets', `visual_sim_${Date.now()}_${i}.info`);
      
      await fs.writeFile(assetPath, JSON.stringify({
        message: 'AI visual asset would be generated here',
        prompt: prompt,
        style: style,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      paths.push(assetPath);
    }
    
    return paths;
  }

  async simulateVideoGeneration(script, visualAssets, audioPath, outputPath) {
    this.logger.info('Simulating video generation...');
    
    const infoPath = outputPath + '.info';
    await fs.writeFile(infoPath, JSON.stringify({
      message: 'AI video would be generated here',
      script: script.title,
      visualAssets: visualAssets.length,
      audioPath: audioPath,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    return infoPath;
  }

  async simulateThumbnailGeneration(script, style) {
    this.logger.info('Simulating thumbnail generation...');
    
    const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `thumbnail_sim_${Date.now()}.info`);
    await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
    
    await fs.writeFile(thumbnailPath, JSON.stringify({
      message: 'AI thumbnail would be generated here',
      title: script.title,
      style: style,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    return {
      path: thumbnailPath,
      dimensions: { width: 1792, height: 1024 },
      fileSize: 1024,
      simulated: true
    };
  }
}

module.exports = { AIVideoGenerator };
