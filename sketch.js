// 导入主题管理器和音效管理器
import { getCurrentTheme } from './themes/themeManager.js';
import { initThemeEffects, playThemeEffect } from './themes/soundManager.js';

// Matter.js 模块别名
const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Body, Query } = Matter;

// 获取当前主题
const currentTheme = getCurrentTheme();

// 音效系统
const sounds = {};
const wordSounds = {};

// 获取emoji对应的英文单词
function getEmojiWord(emoji) {
    const emojiData = currentTheme.emojiData.find(data => data.emoji === emoji);
    return emojiData ? emojiData.word : '';
}

// 初始化主题音效
initThemeEffects();

// 初始化单词音效
currentTheme.emojiData.forEach(({emoji}) => {
    // 单词发音
    const word = getEmojiWord(emoji);
    if (word) {
        // 将单词拆分成数组
        const words = word.split(' ');
        wordSounds[emoji] = words.map(w => {
            // 将每个单词转换为小写
            const formattedWord = w.toLowerCase();
            return new Howl({
                src: [`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${formattedWord}--_gb_1.mp3`],
                html5: true
            });
        });
    }
});


// 播放音效函数
function playSound(emoji) {
    // 播放单词发音
    if (wordSounds[emoji] && wordSounds[emoji].length > 0) {
        // 依次播放每个单词的发音
        let currentIndex = 0;
        const playNext = () => {
            if (currentIndex < wordSounds[emoji].length) {
                setTimeout(() => {
                    wordSounds[emoji][currentIndex].once('end', () => {
                        currentIndex++;
                        playNext();
                    });
                    wordSounds[emoji][currentIndex].play();
                }, 500); // 延迟500ms播放单词发音
            }
        };
        playNext();
    }
}

// 创建引擎
const engine = Engine.create();
const world = engine.world;

// 游戏状态
let score = 0;
let level = 1;
const maxScore = 31500;
const emojiUsageLimit = 63;
const emojiUsageCount = {};

// 游戏难度设置
let gameDifficulty = 'veryEasy'; // 默认非常简单难度
const difficultyConfig = {
    veryEasy: {
        emojiPoolSize: 0.2, // 使用40%的emoji池
        matchProbability: 1.8 // 提高80%匹配概率
    },
    easy: {
        emojiPoolSize: 0.4, // 使用60%的emoji池
        matchProbability: 1.4 // 提高40%匹配概率
    },
    medium: {
        emojiPoolSize: 0.6, // 使用80%的emoji池
        matchProbability: 1.0 // 正常匹配概率
    },
    hard: {
        emojiPoolSize: 0.8, // 使用90%的emoji池
        matchProbability: 0.7 // 降低30%匹配概率
    },
    veryHard: {
        emojiPoolSize: 1.0, // 使用100%的emoji池
        matchProbability: 0.5 // 降低50%匹配概率
    }
};

// 添加难度控制滑块
const difficultyControl = document.createElement('div');
difficultyControl.style.position = 'absolute';
difficultyControl.style.top = '25px';
difficultyControl.style.left = '50%';
difficultyControl.style.transform = 'translateX(-50%)';
difficultyControl.style.color = 'white';
difficultyControl.style.fontFamily = 'Arial';
difficultyControl.style.fontSize = '16px';
difficultyControl.style.zIndex = '10000';
difficultyControl.innerHTML = `
    <div style="margin-bottom: 5px;">难度: <span id="difficultyLabel">非常简单</span></div>
    <input type="range" min="0" max="4" value="0" step="1" id="difficultySlider" style="width: 150px;">
`;
document.body.appendChild(difficultyControl);

// 监听难度变化
const difficultySlider = document.getElementById('difficultySlider');
const difficultyLabel = document.getElementById('difficultyLabel');
difficultySlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    switch(value) {
        case 0:
            gameDifficulty = 'veryEasy';
            difficultyLabel.textContent = '非常简单';
            break;
        case 1:
            gameDifficulty = 'easy';
            difficultyLabel.textContent = '简单';
            break;
        case 2:
            gameDifficulty = 'medium';
            difficultyLabel.textContent = '中等';
            break;
        case 3:
            gameDifficulty = 'hard';
            difficultyLabel.textContent = '困难';
            break;
        case 4:
            gameDifficulty = 'veryHard';
            difficultyLabel.textContent = '极难';
            break;
    }
    // 重置emoji池
    shuffledEmojis = [];
    currentIndex = 0;
});

// 记录最近生成的emoji队列
const recentEmojis = [];
const maxRecentEmojis = 10;

// 游戏尺寸
let gameWidth = window.innerWidth;
let gameHeight = window.innerHeight;

// 关卡配置
const levelConfig = {
    getTargetScore: (level) => Math.floor(level * 1000 * (1 + level * 0.2)),
    getShapeInterval: (level) => Math.max(2000 - (level - 1) * 150, 500),
    getEmojis: (level) => {
        const baseEmojis = currentTheme.emojiData;
        return baseEmojis.slice(0, Math.min(3 + Math.floor((level - 1) * 0.5), baseEmojis.length));
    },
    getSpecialProbability: (level) => Math.min((level - 1) * 0.08, 0.4),
    getDifficulty: (level) => ({
        gravity: 1 + level * 0.1,
        friction: Math.max(0.1, 0.5 - level * 0.05),
        restitution: Math.min(0.8, 0.5 + level * 0.05)
    })
};

// 创建渲染器
const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: gameWidth,
        height: gameHeight,
        wireframes: false,
        background: '#1a1a1a'
    }
});

// 创建边界墙
let walls = [];

function createWalls() {
    // 移除旧的墙
    walls.forEach(wall => Composite.remove(world, wall));
    walls = [];

    const wallOptions = {
        isStatic: true,
        render: {
            fillStyle: '#333'
        }
    };

    // 创建新的墙
    const ground = Bodies.rectangle(gameWidth / 2, gameHeight - 10, gameWidth + 20, 20, wallOptions);
    const leftWall = Bodies.rectangle(10, gameHeight / 2, 20, gameHeight, wallOptions);
    const rightWall = Bodies.rectangle(gameWidth - 10, gameHeight / 2, 20, gameHeight, wallOptions);
    const ceiling = Bodies.rectangle(gameWidth / 2, 10, gameWidth + 20, 20, wallOptions);

    walls = [ground, leftWall, rightWall, ceiling];
    Composite.add(world, walls);
}

// 初始化墙
createWalls();

// 监听窗口大小变化
window.addEventListener('resize', () => {
    gameWidth = window.innerWidth;
    gameHeight = window.innerHeight;

    // 更新渲染器尺寸
    render.canvas.width = gameWidth;
    render.canvas.height = gameHeight;
    render.options.width = gameWidth;
    render.options.height = gameHeight;

    // 重新创建墙
    createWalls();
});

// 创建一些有趣的形状
function createRandomShape(x, y) {
    const emoji = getRandomEmoji();
    // 检查emoji使用次数
    if (!emojiUsageCount[emoji]) emojiUsageCount[emoji] = 0;
    if (emojiUsageCount[emoji] >= emojiUsageLimit) return null;
    
    emojiUsageCount[emoji]++;
    const shape = Bodies.circle(x, y, 25, {
        render: {
            sprite: {
                texture: createEmojiTexture(emoji),
                xScale: 1,
                yScale: 1
            }
        },
        label: 'game-piece',
        gameEmoji: emoji,
        friction: 0.3,
        restitution: 0.6
    });
    return shape;
}

// 生成随机emoji
let shuffledEmojis = [];
let currentIndex = 0;

function getRandomEmoji() {
    // 根据难度获取emoji池大小
    const config = difficultyConfig[gameDifficulty];
    const poolSize = Math.floor(currentTheme.emojiData.length * config.emojiPoolSize);
    const availableEmojis = currentTheme.emojiData.slice(0, poolSize);
    
    // 如果没有洗牌的emoji或者已经用完了当前洗牌的结果
    if (shuffledEmojis.length === 0 || currentIndex >= shuffledEmojis.length) {
        // 创建新的emoji数组
        shuffledEmojis = availableEmojis.map(({emoji}) => {
            const usageCount = emojiUsageCount[emoji] || 0;
            // 根据难度调整匹配概率
            const weight = Math.max(0.1, 1 - (usageCount / emojiUsageLimit)) * config.matchProbability;
            return {
                emoji,
                weight
            };
        });
        
        // Fisher-Yates洗牌算法
        for (let i = shuffledEmojis.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledEmojis[i], shuffledEmojis[j]] = [shuffledEmojis[j], shuffledEmojis[i]];
        }
        
        // 重置索引
        currentIndex = 0;
        
        // 记录最近生成的emoji
        if (recentEmojis.length >= maxRecentEmojis) {
            recentEmojis.shift(); // 移除最旧的emoji
        }
        recentEmojis.push(shuffledEmojis[currentIndex].emoji);
    }
    
    // 获取当前emoji
    const selectedEmoji = shuffledEmojis[currentIndex].emoji;
    currentIndex++;
    
    return selectedEmoji;
}

// 创建emoji纹理
function createEmojiTexture(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 25, 25);
    return canvas.toDataURL();
}

// 检查相邻的相同颜色物体
function checkMatches() {
    const bodies = Composite.allBodies(world).filter(body => body.label === 'game-piece');
    const matches = new Set();

    bodies.forEach(body => {
        const nearby = Query.region(bodies, {
            min: { x: body.position.x - 55, y: body.position.y - 55 },
            max: { x: body.position.x + 55, y: body.position.y + 55 }
        });

        const sameEmojiNearby = nearby.filter(other => 
            other.gameEmoji === body.gameEmoji && 
            other.id !== body.id &&
            Matter.Vector.magnitude(Matter.Vector.sub(body.position, other.position)) < 55
        );

        if (sameEmojiNearby.length >= 2) {
            matches.add(body);
            sameEmojiNearby.forEach(match => matches.add(match));
        }
    });

    // 添加单词显示区域
    let wordDisplay = document.querySelector('.word-display');
    if (!wordDisplay) {
        wordDisplay = document.createElement('div');
        wordDisplay.className = 'word-display';
        wordDisplay.style.position = 'absolute';
        wordDisplay.style.top = '75px';
        wordDisplay.style.left = '50%';
        wordDisplay.style.transform = 'translateX(-50%)';
        wordDisplay.style.color = 'white';
        wordDisplay.style.fontFamily = 'Arial';
        wordDisplay.style.fontSize = '24px';
        wordDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        wordDisplay.style.padding = '15px 30px';
        wordDisplay.style.borderRadius = '10px';
        wordDisplay.style.display = 'flex';
        wordDisplay.style.alignItems = 'center';
        wordDisplay.style.gap = '10px';
        wordDisplay.style.opacity = '0';
        wordDisplay.style.transition = 'opacity 0.3s ease-in-out';
        wordDisplay.style.pointerEvents = 'none';
        wordDisplay.style.zIndex = '10000';
        document.body.appendChild(wordDisplay);
    }

    if (matches.size >= 3) {
        // 播放主题音效
        const matchedEmoji = Array.from(matches)[0];
        const emojiData = currentTheme.emojiData.find(data => data.emoji === matchedEmoji.gameEmoji);
        if (emojiData && emojiData.theme) {
            playThemeEffect(emojiData.theme);
        }

        // 更新分数
        score += 30;
        // 移除匹配的物体
        matches.forEach(body => {
            Composite.remove(world, body);
            createExplosion(body.position.x, body.position.y, body.gameEmoji);
            playSound(body.gameEmoji);  // 播放对应的音效和单词发音
            
            // 获取并显示单词信息
            const emojiData = currentTheme.emojiData.find(data => data.emoji === body.gameEmoji);
            if (emojiData) {
                wordDisplay.innerHTML = `<span style="font-size: 32px">${emojiData.emoji}</span> <span>${emojiData.word}</span> <span style="color: #aaa">${emojiData.translation || ''}</span>`;
                wordDisplay.style.opacity = '1';
                setTimeout(() => {
                    wordDisplay.style.opacity = '0';
                }, 2000);
            }
        });

        // 检查是否达到满分
        if (score >= maxScore) {
            alert('恭喜你通关啦，休息一下吧');
            // 停止游戏
            if (shapeInterval) clearInterval(shapeInterval);
            Runner.stop(engine);
        }

        return true;
    }

    return false;
}

// 创建爆炸效果
function createExplosion(x, y, emoji) {
    for (let i = 0; i < 8; i++) {
        const particle = Bodies.circle(x, y, 5, {
            render: {
                sprite: {
                    texture: createEmojiTexture(emoji),
                    xScale: 0.3,
                    yScale: 0.3
                }
            },
            frictionAir: 0.1,
            label: 'particle',
            timeCreated: Date.now()
        });

        const angle = (Math.PI * 2 / 8) * i;
        Body.setVelocity(particle, {
            x: Math.cos(angle) * 5,
            y: Math.sin(angle) * 5
        });

        Composite.add(world, particle);
    }
}

// 添加鼠标控制
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: {
            visible: false
        }
    }
});

Composite.add(world, mouseConstraint);
render.mouse = mouse;

// 点击事件监听
Events.on(mouseConstraint, 'mousedown', function(event) {
    const mousePosition = event.mouse.position;
    const shape = createRandomShape(
        mousePosition.x,
        mousePosition.y
    );
    if (shape) {
        Composite.add(world, shape);
        // 播放主题音效
        const emojiData = currentTheme.emojiData.find(data => data.emoji === shape.gameEmoji);
        if (emojiData && emojiData.theme) {
            playThemeEffect(emojiData.theme);
        } else {
            // 如果没有指定主题，使用默认主题
            playThemeEffect('fruit');
        }
    }
});

// 定期添加新的形状
let shapeInterval;
function updateShapeInterval() {
    if (shapeInterval) clearInterval(shapeInterval);
    shapeInterval = setInterval(() => {
        if (Composite.allBodies(world).length < 50) {
            const shape = createRandomShape(
                Math.random() * (gameWidth - 100) + 50,
                50
            );
            if (shape) {
                Composite.add(world, shape);
                // 播放主题音效
                const emojiData = currentTheme.emojiData.find(data => data.emoji === shape.gameEmoji);
                if (emojiData && emojiData.theme) {
                    playThemeEffect(emojiData.theme);
                }
            }
        }
    }, 2000);
}

// 定期检查匹配
setInterval(() => {
    checkMatches();
}, 500);

// 清理爆炸粒子
Events.on(engine, 'beforeUpdate', () => {
    const particles = Composite.allBodies(world).filter(body => body.label === 'particle');
    particles.forEach(particle => {
        if (Date.now() - particle.timeCreated > 1000) {
            Composite.remove(world, particle);
        }
    });
});

// 添加分数显示
const scoreDisplay = document.createElement('div');
scoreDisplay.style.position = 'absolute';
scoreDisplay.style.top = '25px';
scoreDisplay.style.left = '30px';
scoreDisplay.style.zIndex = '10000';
scoreDisplay.style.color = 'white';
scoreDisplay.style.fontFamily = 'Arial';
scoreDisplay.style.fontSize = '20px';
document.body.appendChild(scoreDisplay);

// 更新分数显示
Events.on(engine, 'beforeUpdate', () => {
    scoreDisplay.textContent = `分数: ${score} / ${maxScore}`;
});

// 运行引擎
Runner.run(engine);
Render.run(render);