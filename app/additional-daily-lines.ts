import poetryNoteUrls from "../scripts/xhs-poetry-note-urls.json";

export type AdditionalDailyLine = {
  text: string;
  credit: string;
  source: string;
  href: string;
};

function note(noteId: string) {
  const href = poetryNoteUrls.find((url) => url.includes(`/${noteId}?`));
  if (!href) throw new Error(`Missing Xiaohongshu note URL: ${noteId}`);
  return href;
}

export const additionalDailyLines: AdditionalDailyLine[] = [
  { text: "我轻松愉快走上大路，我健康自由，世界在我面前。", credit: "沃尔特·惠特曼", source: "《草叶集》", href: note("6a2a6d93000000003503b798") },
  { text: "为什么我好想告诉他我是谁。", credit: "林奕华", source: "《为什么我好想告诉他我是谁》", href: note("6a151fe90000000036000d7c") },
  { text: "我渴望未知、大海、陌生的人和新的体验。", credit: "希内德·格利森", source: "《我身体里的人造星星》", href: note("6a75869300000000220116e7") },
  { text: "最美的是对夏天的期待。", credit: "赫尔曼·黑塞", source: "《迎向夏天》", href: note("6a75869300000000220116e7") },
  { text: "你是我盛夏的海浪，是我义无反顾的蓝。", credit: "北岛", source: "《蓝房子》", href: note("6a75869300000000220116e7") },
  { text: "大家都在这里做什么？不做什么，就是等夏天结束。", credit: "安德烈·艾席蒙", source: "《夏日终曲》", href: note("6a75869300000000220116e7") },
  { text: "我躺在清风吹拂的小山岗上，望着云团汹涌的天空。", credit: "阿来", source: "《尘埃落定》", href: note("6a72eb2e000000003301b0c2") },
  { text: "月亮升起的时候，大海淹没陆地，而心像一座小岛在无穷里。", credit: "费德里科·加西亚·洛尔迦", source: "《月亮》", href: note("6a72eb2e000000003301b0c2") },
  { text: "安静地睡觉，什么欲望也没有。", credit: "费尔南多·佩索阿", source: "《在这儿，海岸的沙滩》", href: note("6a72eb2e000000003301b0c2") },
  { text: "我满有夏天的感情，像一个果子浸透了蜜酒。", credit: "汪曾祺", source: "《钓》", href: note("6a6ed9bc0000000024027122") },
  { text: "夏日里偶尔躺在树荫下的草坪上，这绝不是浪费时光。", credit: "艾什尔里", source: "《优游岁月》", href: note("6a6ed9bc0000000024027122") },
  { text: "即使在最炎热的盛夏，我们仍能在天空中找到凉爽与宁静。", credit: "加文·普雷特-平尼", source: "《一天一朵云》", href: note("6a6c633c0000000025001fac") },
  { text: "盛夏有一天，完全为我前来。", credit: "艾米莉·狄金森", source: "《盛夏有一天》", href: note("6a6c633c0000000025001fac") },
  { text: "她只是花了比别人更长的时间，才找到自己是什么。", credit: "温泠", source: "《没有女人的女人们（木棉）》", href: note("6a6b0e1f0000000022010409") },
  { text: "还是要真正和谁说过再见，才能变成完整的人。", credit: "徐佩芬", source: "《还是要有家具才能活得不悲伤》", href: note("6a6b0e1f0000000022010409") },
  { text: "我愿意把所有悲沉化约到一种素朴的乐观上。", credit: "简媜", source: "《四月裂帛》", href: note("6a6b0e1f0000000022010409") },
  { text: "在白天，我什么都不是；到了夜晚，我才成为我自己。", credit: "费尔南多·佩索阿", source: "《惶然录》", href: note("6a6b0e1f0000000022010409") },
  { text: "冰激凌会融化，皱纹会在脸上开花。", credit: "多多", source: "《当你说放不下》", href: note("6a61d8b1000000000f02b757") },
  { text: "或许还有别的、更轻盈的方式，让你对自己产生不同看法。", credit: "张晚禾", source: "《阿司匹林》", href: note("6a61d8b1000000000f02b757") },
  { text: "有人喊我的名字像夏天，冰块沿着杯缘撞击。", credit: "夏宇", source: "《腹语术》", href: note("6a61d8b1000000000f02b757") },
  { text: "请待在那儿，因为你很重要。", credit: "弗雷德里克·巴克曼", source: "《清单人生》", href: note("6a5c331c00000000110049f5") },
  { text: "坐在你身边看云，我看得更清楚。", credit: "费尔南多·佩索阿", source: "《拥有你以前》", href: note("6a5c331c00000000110049f5") },
  { text: "没有早一步，也没有晚一步，刚巧赶上了。", credit: "张爱玲", source: "《流言》", href: note("6a5c331c00000000110049f5") },
  { text: "我爱不带目的地散步，在阳光下小憩，自由地流浪。", credit: "赫尔曼·黑塞", source: "《克林索尔的最后夏天》", href: note("6a55d039000000000f01f516") },
  { text: "我更喜欢这夏天的心脏。", credit: "郭沫若", source: "《丁东草》", href: note("6a55d039000000000f01f516") },
  { text: "只要太阳、草地，偶尔吹来的海风。", credit: "安德烈·艾席蒙", source: "《夏日终曲》", href: note("6a55d039000000000f01f516") },
  { text: "从明天起，做一个幸福的人。", credit: "海子", source: "《面朝大海，春暖花开》", href: note("6a505e250000000011012316") },
  { text: "夏天的日子就像波浪一样，先聚集，然后流散开去。", credit: "弗吉尼亚·伍尔夫", source: "《达洛维夫人》", href: note("6a4c5d63000000001003f73b") },
  { text: "阳光注满树叶，七月在蝴蝶间浮游。", credit: "W. S. 默温", source: "《夏日天空》", href: note("6a447839000000000f0289b6") },
  { text: "我的七月，在告别。", credit: "舒婷", source: "《那一年七月》", href: note("6a447839000000000f0289b6") },
  { text: "您还年轻，像夏天的六月。您还来日方长。", credit: "安东·契诃夫", source: "作品摘录", href: note("6a334f4e000000001101ed1d") },
  { text: "六月的一个早晨，醒来太早，但回到梦里已为时太晚。", credit: "托马斯·特朗斯特罗姆", source: "《记忆看见我》", href: note("6a334f4e000000001101ed1d") },
  { text: "在六月的起始，每一次日落都是特别的。", credit: "约翰·斯坦贝克", source: "《烦恼的冬天》", href: note("6a320224000000001101018b") },
  { text: "没有什么能阻止你，最好的日子不能，汹涌的海也不能。", credit: "马克·斯特兰德", source: "《我们生活的故事》", href: note("6a38f5b60000000011004094") },
  { text: "那些没说出口的话，最后都成为我的海洋了。", credit: "宋尚纬", source: "《我的海》", href: note("6a38f5b60000000011004094") },
  { text: "我迷失方向，发现自己在长河里；又一次我被抱住，而我紧抱住世界。", credit: "西奥多·罗特克", source: "《长河》", href: note("6a2a2911000000003501f76b") },
  { text: "没有路的时候会迷路，路多了的时候也会迷路。", credit: "迟子建", source: "《额尔古纳河右岸》", href: note("6a2a2911000000003501f76b") },
  { text: "像汽水里的泡泡，能靠自己的力量慢慢升起。", credit: "《神秘巨星》", source: "电影台词", href: note("6a28f7b40000000022019bd8") },
  { text: "我会爱你整个夏天，这听起来比一辈子更有说服力。", credit: "玛丽娜·茨维塔耶娃", source: "《手记》", href: note("6a263547000000000800119f") },
  { text: "如果爱一个人，不能只爱他的夏天。", credit: "徐佩芬", source: "《梦》", href: note("6a263547000000000800119f") },
  { text: "第一阵炎热到来时，我的事情就要有新的进展。", credit: "阿尔贝·加缪", source: "《局外人》", href: note("6a263547000000000800119f") },
  { text: "天空里晨光辉煌，我的前途是美丽的。", credit: "拉宾德拉纳特·泰戈尔", source: "《吉檀迦利》", href: note("6a212c660000000021009f0b") },
  { text: "我总觉得好运气在等着我，美妙的事正向我走近。", credit: "史铁生", source: "《插队的故事》", href: note("6a212c660000000021009f0b") },
  { text: "世界在我面前，我自己就是好运气。", credit: "沃尔特·惠特曼", source: "《草叶集》", href: note("6a212c660000000021009f0b") },
  { text: "在夏天，我们吃绿豆、桃、樱桃和甜瓜。", credit: "罗伯特·瓦尔泽", source: "《夏天》", href: note("6a20efe20000000006022609") },
  { text: "阳光好的时候就把自己放进去，像放一块陈皮。", credit: "余秀华", source: "《我爱你》", href: note("6a20efe20000000006022609") },
  { text: "不要忧郁，这跟你不相称。祝你快活。", credit: "安东·契诃夫", source: "作品摘录", href: note("6a1cfcab000000000702d11c") },
  { text: "你双脚踏上从未驻足的土地，双眼面对从未见过的风景。", credit: "路易斯·塞尔努达", source: "《朝圣者》", href: note("6a1cfcab000000000702d11c") },
  { text: "自由的人，你将永把大海爱恋。", credit: "夏尔·波德莱尔", source: "《人与海》", href: note("6a1cfcab000000000702d11c") },
  { text: "别担心，你失去的快乐会以另一种形式重归于你。", credit: "贾拉勒丁·鲁米", source: "作品摘录", href: note("6a1cfcab000000000702d11c") },
  { text: "生命也许没有答案，但也要尽情感受。", credit: "弗吉尼亚·伍尔夫", source: "作品摘录", href: note("6a1cfcab000000000702d11c") },
  { text: "复返的初夏轮回而至，我初次遇见夏天。", credit: "谷川俊太郎", source: "《二十亿光年的孤独》", href: note("6a06934a000000000702e62b") },
  { text: "地球在走动，初夏的天空里有逃跑的云。", credit: "张枣", source: "《纪念日》", href: note("6a06934a000000000702e62b") },
  { text: "年轻常常意味着一无所有，也意味着什么都不需要拥有。", credit: "曹韵", source: "《一个人正当年轻》", href: note("6a02c6780000000007024e04") },
  { text: "趁我们还年轻，把能走的路都走了。", credit: "倪湛", source: "《夏与西伯利亚》", href: note("6a02c6780000000007024e04") },
  { text: "打破夏日最后的誓言，就像咬碎葵花子一样。", credit: "耶胡达·阿米亥", source: "《雨转瞬将至》", href: note("6a4e3a40000000000f033730") },
  { text: "门前的小路告诉人们：这里可以到达。", credit: "黄锐", source: "《夏末》", href: note("6a48f0d80000000011018068") },
  { text: "幸福是轻而易举的，秋阳灿亮。", credit: "简媜", source: "《夜色》", href: note("6a1419850000000035024bba") },
  { text: "要不计代价地追求快乐。", credit: "阿尔贝·加缪", source: "《快乐的死》", href: note("6a0c4c12000000003503a280") },
  { text: "把人生塑造、打磨，最后去爱上它。", credit: "阿尔贝·加缪", source: "《快乐的死》", href: note("6a0c4c12000000003503a280") },
  { text: "梦之蝴蝶，你就像我的灵魂。", credit: "巴勃罗·聂鲁达", source: "《二十首情诗和一首绝望的歌》", href: note("6a0aff8b000000003501e3d3") },
  { text: "往往是还未开始爱，爱已过去了。", credit: "木心", source: "《乙辑》", href: note("6a05b04b0000000035038819") },
  { text: "所谓世界，不过是一条一条的街。", credit: "木心", source: "《乙辑》", href: note("6a05b04b0000000035038819") },
  { text: "在那高高的草原上，白云浮动。", credit: "海子", source: "《给你》", href: note("6a630f67000000001101eea6") },
  { text: "我坐在茫茫太平洋上折梅，写信。", credit: "海子", source: "《给萨福》", href: note("6a630e4900000000110100f9") },
  { text: "风后面是风，天空上面是天空，道路前面还是道路。", credit: "海子", source: "《四姐妹》", href: note("6a50602e000000001003cfe4") },
  { text: "你来人间一趟，你要看看太阳。", credit: "海子", source: "《夏天的太阳》", href: note("6a3cac18000000000f03037f") },
  { text: "语言的本身像母亲，总有话说。", credit: "海子", source: "《语言和井》", href: note("6a478740000000001100739a") },
  { text: "明天起来后我要重新做人，我要成为宇宙的孩子。", credit: "海子", source: "《十四行：玫瑰花园》", href: note("6a47140a000000000f02ae8b") },
  { text: "六月，你和夏天来了，大雨如注。", credit: "殷伟东", source: "《天》", href: note("6a320224000000001101018b") },
  { text: "夏乃声音的季节，有雨打、雷响、蛙声、鸟鸣及蝉唱。", credit: "简媜", source: "《水问》", href: note("6a320224000000001101018b") },
  { text: "我栖身在无限可能中。", credit: "艾米莉·狄金森", source: "《我栖身在无限可能中》", href: note("6a2a2093000000002202ee14") },
];
