// 音效管理器
let audioContext;

// 初始化音频上下文
function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// 生成音效配置
const soundEffects = {
    fruit: {
        frequency: 880, // A5音 - 清脆的高音
        duration: 0.15,
        type: 'sine',
        gain: 0.4
    },
    animal: {
        frequency: 440, // A4音 - 温和的中音
        duration: 0.3,
        type: 'sawtooth',
        gain: 0.3
    },
    vegetable: {
        frequency: 220, // A3音 - 低沉的音色
        duration: 0.4,
        type: 'triangle',
        gain: 0.5
    },
    seasoning: {
        frequency: 660, // E5音 - 明亮的高音
        duration: 0.2,
        type: 'square',
        gain: 0.35,
        tremolo: true
    },
    cereal: {
        frequency: 330, // E4音 - 温暖的中音
        duration: 0.35,
        type: 'sine',
        gain: 0.45,
        echo: true
    }
};

// 初始化音效系统
export function initThemeEffects() {
    initAudioContext();
    // 如果用户与页面交互，确保音频上下文已启动
    document.addEventListener('click', () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });
}

// 播放音效
export function playThemeEffect(theme) {
    if (!audioContext || !soundEffects[theme]) return;

    const config = soundEffects[theme];
    
    // 创建振荡器
    const oscillator = audioContext.createOscillator();
    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime);

    // 创建音量控制
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(config.gain || 0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);

    // 添加颤音效果
    if (config.tremolo) {
        const tremoloOsc = audioContext.createOscillator();
        const tremoloGain = audioContext.createGain();
        tremoloOsc.frequency.value = 8;
        tremoloGain.gain.value = 0.3;
        tremoloOsc.connect(tremoloGain);
        tremoloGain.connect(gainNode.gain);
        tremoloOsc.start();
        setTimeout(() => tremoloOsc.stop(), config.duration * 1000);
    }

    // 添加回声效果
    if (config.echo) {
        const delay = audioContext.createDelay();
        const echoGain = audioContext.createGain();
        delay.delayTime.value = 0.1;
        echoGain.gain.value = 0.3;
        gainNode.connect(delay);
        delay.connect(echoGain);
        echoGain.connect(audioContext.destination);
    }

    // 连接节点
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 播放音效
    oscillator.start();
    oscillator.stop(audioContext.currentTime + config.duration);

    // 在音效结束后断开连接
    setTimeout(() => {
        oscillator.disconnect();
        gainNode.disconnect();
    }, config.duration * 1000);
}