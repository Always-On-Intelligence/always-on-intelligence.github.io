import { STRINGS as BASE } from '../eccv/i18n.mjs';

// NTU strings on top of the shared interface strings.
const OVERRIDES = {
  en: {
    brand: 'Glasses · always on',
    session: 'NTU · Tuesday',
    mapLabel: 'Campus around you', mapTitle: 'NTU campus', mapSub: 'Click a spot, or a place below, to go there',
    startTour: 'Start the S-Lab day', stopTour: 'Stop the day', trail: 'My day',
    hint: 'Move the mouse to look, rest it near an edge to keep turning · W A S D to walk, Shift to run · E to go in · click a person to say hi',
    contract: 'Contract · weekdays 08:00–22:00',
    jump: 'Jump there', places: 'Places',
    srcEgo: 'Common today', srcEgoShort: 'Today',
  },
  zh: {
    brand: '眼镜 · 常开',
    session: 'NTU · 周二',
    mapLabel: '你周围的校园', mapTitle: 'NTU 校园', mapSub: '点击地图上的位置或下方的地点，直接过去',
    startTour: '开始 S-Lab 的一天', stopTour: '停止', trail: '我的一天',
    hint: '移动鼠标环顾，停在左右边缘会持续转向 · W A S D 走路，Shift 跑 · E 进楼 · 点击面前的人打招呼',
    contract: '约定 · 工作日 08:00–22:00',
    jump: '跳过去', places: '地点',
    srcEgo: '现在已常见', srcEgoShort: '已常见',
  },
};

export function makeT(lang) {
  const table = { ...BASE.en, ...OVERRIDES.en, ...(lang === 'zh' ? { ...BASE.zh, ...OVERRIDES.zh } : {}) };
  return (key) => table[key] ?? key;
}
