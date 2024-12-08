
/** 
 * @memberof AudioEngine 
 * @class
 */
export class AudioPlayer {
    constructor(audioFilePath) {
/*         if (!audioFilePath) {
            console.error('AudioPlayer Error: No audio file path provided.');
            return;
        } */

        //this.audio = new Audio(audioFilePath);
        //this.audio.loop = false; // Set to true if you want the audio to loop
        //this.audio.preload = 'auto'; // Preload the audio for smoother playback
    }

    play() {
        //this.audio.play().catch(error => {
        //    console.error('AudioPlayer Play Error:', error);
        //});
    }

    pause() {
        //this.audio.pause();
    }

    stop() {
        //this.audio.pause();
        //this.audio.currentTime = 0;
    }

    setVolume(volume) {
/*         if (volume < 0 || volume > 1) {
            console.warn('AudioPlayer Warning: Volume should be between 0.0 and 1.0');
            return;
        } */
        //this.audio.volume = volume;
    }

    mute() {
        //this.audio.muted = true;
    }

    unmute() {
        //this.audio.muted = false;
    }
}