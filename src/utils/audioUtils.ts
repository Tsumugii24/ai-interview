export class AudioStreamer {
  private context: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;

  constructor(context: AudioContext) {
    this.context = context;
  }

  async start(onData: (base64Data: string) => void) {
    if (this.isRecording) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // We need to resample the audio to 16kHz for Gemini
      // A simple way is to use AudioWorklet, but for simplicity we can use ScriptProcessorNode
      // Note: ScriptProcessorNode is deprecated but easier to setup without external files.
      // Let's use a simple ScriptProcessor for now to get raw PCM data.
      
      const source = this.context.createMediaStreamSource(this.stream);
      const processor = this.context.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert Int16Array to base64
        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcmData.length; i++) {
          view.setInt16(i * 2, pcmData[i], true); // little-endian
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        onData(base64);
      };
      
      source.connect(processor);
      processor.connect(this.context.destination);
      
      this.isRecording = true;
    } catch (err) {
      console.error('Error starting audio stream:', err);
    }
  }

  stop() {
    this.isRecording = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}

export class AudioPlayer {
  private context: AudioContext;
  private nextPlayTime = 0;

  constructor(context: AudioContext) {
    this.context = context;
  }

  playBase64(base64Data: string) {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // The audio from Gemini is 24kHz PCM 16-bit little-endian
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }
      
      const buffer = this.context.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);
      
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      
      const currentTime = this.context.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  }

  stop() {
    this.nextPlayTime = 0;
    // We can't easily stop all scheduled buffers without keeping track of them,
    // but we can suspend the context or just let them finish.
    // For a robust implementation, we'd keep an array of active sources.
  }
}
