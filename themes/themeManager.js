// 导入所有主题
import animalTheme from './animal.js';
import fruitTheme from './fruit.js';
import vegetableTheme from './vegetable.js';
import seasoningTheme from './seasoning.js';
import cerealTheme from './cereal.js';

// 主题映射
const themes = {
    animal: animalTheme,
    fruit: fruitTheme,
    vegetable: vegetableTheme,
    seasoning: seasoningTheme,
    cereal: cerealTheme
};

// 获取当前主题
function getCurrentTheme() {
    // 从URL参数中获取主题名称
    const urlParams = new URLSearchParams(window.location.search);
    const themeName = urlParams.get('theme') || 'animal';
    return themes[themeName] || themes.animal;
}

// 导出主题管理器
export { getCurrentTheme };