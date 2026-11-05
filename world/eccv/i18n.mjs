// Interface strings. Story text lives next to each beat in story.mjs.

export const STRINGS = {
  en: {
    brand: 'EgoPoster · always on',
    camera: 'Camera', mic: 'Mic', privacy: 'Faces blurred',
    privacyTip: 'Faces and screens are blurred before any processing',
    loopTitle: 'The loop, live', loopSub: 'Sensing, Memory and Action, and what flows between them',
    modS: 'Sensing', modM: 'Memory', modA: 'Action',
    world: 'World', worldIn: 'camera · mic', worldOut: 'glasses · phone',
    srcEgo: 'EgoPoster today', srcTarget: 'Always-on target', srcExt: 'Self-evolving extension',
    srcEgoShort: 'EgoPoster', srcTargetShort: 'Target', srcExtShort: 'Extension',
    k_act: 'act', k_wait: 'wait', k_request: 'request', k_boundary: 'boundary', k_revise: 'θ',
    m_policy: 'Policy', m_grounds: 'Grounds', m_condition: 'Condition', m_build: 'How to build it',
    howBuilt: 'Policy, grounds, how to build ›',
    mapLabel: 'Floor plan around you', openMap: 'Map', mapTitle: 'Malmömässan · ground floor', mapSub: 'Click a spot to go there',
    startTour: 'Start the guided walk', stopTour: 'Stop the walk', overview: 'Overview', trail: 'My trail', about: 'About this demo',
    takeOff: 'Take off glasses', putOn: 'Put glasses on',
    glassesOffTitle: 'Glasses off', glassesOffText: 'No camera, no display. Your open tasks and the decision whether to help keep running on the phone.',
    hint: 'Move the mouse to look, rest it near an edge to keep turning · W A S D to walk, Shift to run · click a poster or a person in front of you',
    lockHint: 'Move the mouse to look around',
    close: 'Close', fromSensing: 'Built from what the glasses saw and heard',
    session: 'Poster Session 6 · ExHall',
    insights: 'Key insights', questions: 'Ask the author', connections: 'Why it matters to you', next: 'Next stop',
    fromPoster: 'From the poster', topic: 'Topic', comeBack: 'Remind me when the presenter is free',
    contract: 'Contract · until 17:00',
    speed: 'Speed', skip: 'Skip scene', chapters: 'Scenes',
  },
  zh: {
    brand: 'EgoPoster · 常开',
    camera: '摄像头', mic: '麦克风', privacy: '人脸已模糊',
    privacyTip: '人脸和屏幕在任何处理之前先做模糊',
    loopTitle: '循环，实时', loopSub: 'Sensing、Memory、Action，以及它们之间流动的信息',
    modS: 'Sensing', modM: 'Memory', modA: 'Action',
    world: '世界', worldIn: '摄像头 · 麦克风', worldOut: '眼镜 · 手机',
    srcEgo: 'EgoPoster 已有', srcTarget: 'always-on 目标形态', srcExt: '自进化扩展',
    srcEgoShort: 'EgoPoster', srcTargetShort: '目标形态', srcExtShort: '扩展',
    k_act: '行动', k_wait: '等待', k_request: '请求', k_boundary: '边界', k_revise: 'θ',
    m_policy: '策略', m_grounds: '依据', m_condition: '条件', m_build: '怎么搭',
    howBuilt: '策略、依据、怎么搭 ›',
    mapLabel: '你周围的平面图', openMap: '地图', mapTitle: 'Malmömässan · 一层', mapSub: '点击任意位置直接过去',
    startTour: '开始导览', stopTour: '停止导览', overview: '俯瞰', trail: '我的足迹', about: '关于这个演示',
    takeOff: '摘下眼镜', putOn: '戴上眼镜',
    glassesOffTitle: '眼镜已摘下', glassesOffText: '没有摄像头，也没有显示。你的待办和「要不要帮你」的判断，在手机上继续运行。',
    hint: '移动鼠标环顾，停在左右边缘会持续转向 · W A S D 走路，Shift 跑 · 点击面前的 Poster 或人',
    lockHint: '移动鼠标即可环顾',
    close: '关闭', fromSensing: '来自眼镜看到和听到的内容',
    session: 'Poster Session 6 · ExHall',
    insights: '要点', questions: '可以问作者', connections: '和你的关联', next: '下一站',
    fromPoster: '来自 Poster', topic: '主题', comeBack: '讲者空了提醒我',
    contract: '约定 · 至 17:00',
    speed: '速度', skip: '跳过这一幕', chapters: '场景',
  },
};

export function makeT(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return (key) => table[key] ?? STRINGS.en[key] ?? key;
}

/** Pick the language variant of a {en, zh} pair. */
export function makeL(lang) {
  return (pair) => (pair == null ? '' : typeof pair === 'string' ? pair : pair[lang] ?? pair.en);
}
