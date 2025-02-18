// 导入所有主题
import animalTheme from './animal.js';
import plantTheme from './plant.js';
import foodTheme from './food.js';
import jobTheme from './job.js';
import emotionTheme from './emotion.js';

// 主题映射
const themes = {
    animal: animalTheme,
    plant: plantTheme,
    food: foodTheme,
    job: jobTheme,
    emotion: emotionTheme
};

// 获取当前主题
function getCurrentTheme() {
    // 从URL参数中获取主题名称
    const urlParams = new URLSearchParams(window.location.search);
    const themeName = urlParams.get('theme');
    
    // 如果URL中指定了有效的主题，则返回对应主题，否则默认返回动物主题
    return themes[themeName] || themes.animal;
}

// 导出主题管理器
export { getCurrentTheme };