// ModeManager.js
export class ModeManager {
    constructor() {
        this.currentMode = 'JAM'; // default mode
        this.subscribers = [];
        this.modes = {
            'JAM': { onEnter: () => {}, onExit: () => {} },
            'MIDI_LEARN': { onEnter: () => {}, onExit: () => {} },
            'SENSORS': { onEnter: () => {}, onExit: () => {} },
            'COSMIC_LFO': { onEnter: () => {}, onExit: () => {} },
        };
    }

    registerMode(name, { onEnter, onExit }) {
        this.modes[name] = { onEnter, onExit };
    }

    activateMode(newMode) {
        if (!this.modes[newMode]) {
            console.warn(`ModeManager: mode ${newMode} not defined`);
            return;
        }

        // Exit current mode
        const oldMode = this.currentMode;
        if (this.modes[oldMode] && this.modes[oldMode].onExit) {
            this.modes[oldMode].onExit();
        }

        this.currentMode = newMode;

        // Enter new mode
        if (this.modes[newMode].onEnter) {
            this.modes[newMode].onEnter();
        }

        // Notify subscribers
        this.subscribers.forEach(cb => cb(newMode));
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    getActiveMode() {
        return this.currentMode;
    }
}

export const ModeManagerInstance = new ModeManager();