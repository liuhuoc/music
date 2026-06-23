export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  source: string;
  duration: number;
  lyrics: string;
  isLive?: boolean;
}

export const mockSongs: Song[] = [
  {
    id: '1',
    title: '屋顶',
    artist: '周杰伦、温岚、吴宗宪',
    album: '屋顶',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 268,
    lyrics: `[00:00.00]屋顶
[00:15.00]半夜睡不着觉
[00:18.50]把心情哼成歌
[00:22.00]只好到屋顶找另一个梦境
[00:28.00]睡梦中被敲醒
[00:31.50]我还是不确定
[00:35.00]怎会有动人旋律在对面的屋顶
[00:41.00]我悄悄关上门
[00:44.50]带着希望上去
[00:48.00]原来是我梦里常出现的人
[00:54.00]那个人不就是我梦里
[01:00.00]那模糊的人
[01:06.00]我们有同样的默契`,
  },
  {
    id: '2',
    title: '想你就写信 (Live)',
    artist: '周杰伦、李硕、张鑫',
    album: 'Live Collection',
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 245,
    isLive: true,
    lyrics: `[00:00.00]想你就写信
[00:12.00]浪花拍打沙滩
[00:15.50]我却对你情有独钟
[00:19.00]我陪你留下
[00:22.50]说最浪漫的话
[00:26.00]即便是青春的懵懂
[00:32.00]但是我们渐行渐远
[00:38.00]逐渐带上现实的枷锁`,
  },
  {
    id: '3',
    title: '布拉格广场',
    artist: '蔡依林、周杰伦',
    album: '看我72变',
    cover: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 294,
    lyrics: `[00:00.00]布拉格广场
[00:08.00]琴键上透着光
[00:12.00]彩绘的玻璃窗
[00:16.00]装饰着歌特式教堂
[00:20.00]谁谁谁弹一段
[00:24.00]一段流浪忧伤
[00:28.00]顺着琴声方向看见`,
  },
  {
    id: '4',
    title: '默 (Live)',
    artist: '李荣浩、周杰伦',
    album: 'Live Collection',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop',
    source: 'QQ音乐',
    duration: 280,
    isLive: true,
    lyrics: `[00:00.00]默
[00:15.00]忍不住化身一条固执的鱼
[00:22.00]逆着洋流独自游到底
[00:29.00]年少时候虔诚发过的誓
[00:36.00]沉默地沉没在深海里`,
  },
  {
    id: '5',
    title: '因为爱情 (Live)',
    artist: '周杰伦、那英',
    album: 'Live Collection',
    cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 256,
    isLive: true,
    lyrics: `[00:00.00]因为爱情
[00:10.00]给你一张过去的CD
[00:16.00]听听那时我们的爱情
[00:22.00]有时会突然忘了
[00:27.00]我还在爱着你`,
  },
  {
    id: '6',
    title: '刀马旦',
    artist: '李玟、周杰伦',
    album: 'Promise',
    cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=400&fit=crop',
    source: '酷狗',
    duration: 234,
    lyrics: `[00:00.00]刀马旦
[00:08.00]明明早上人还在香港
[00:12.00]还在九龙茶馆喝煲汤
[00:16.00]怎么场景一下跳西安
[00:20.00]我在护城河的堤岸`,
  },
  {
    id: '7',
    title: '骑士精神',
    artist: '蔡依林、周杰伦',
    album: '看我72变',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 278,
    lyrics: `[00:00.00]骑士精神
[00:12.00]像骑士的忠贞
[00:16.00]不畏惧邪恶的眼神
[00:20.00]这过程一直放在我心底
[00:24.00]就像挡在你胸前的盔甲`,
  },
  {
    id: '8',
    title: 'Angel',
    artist: 'Sarah McLachlan',
    album: 'Surfacing',
    cover: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 296,
    lyrics: `[00:00.00]Angel
[00:15.00]Spend all your time waiting
[00:20.00]For that second chance
[00:25.00]For a break that would make it okay`,
  },
  {
    id: '9',
    title: '海屿你',
    artist: '马也_Crabbit',
    album: '海屿你',
    cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 295,
    lyrics: `[00:00.00]海屿你
[00:10.00]浪也拍打着沙
[00:14.00]我却对你情有独钟
[00:18.00]我陪你留下
[00:22.00]说最浪漫的话
[00:26.00]即便是青春的懵懂
[00:32.00]但是我们渐行渐远
[00:38.00]逐渐带上现实的枷锁`,
  },
  {
    id: '10',
    title: '小半',
    artist: '陈粒',
    album: '小梦大半',
    cover: 'https://images.unsplash.com/photo-1496293455970-f8581aae0e3c?w=400&h=400&fit=crop',
    source: '网易云',
    duration: 248,
    lyrics: `[00:00.00]小半
[00:12.00]不敢回看
[00:16.00]左顾右盼不自然的暗自喜欢
[00:22.00]偷偷搭讪总没完地坐立难安`,
  },
];

export const hotSearches = [
  { rank: 1, title: 'Angel', heat: 3, label: '超级热' },
  { rank: 2, title: '海屿你', heat: 2, label: '很热' },
  { rank: 3, title: '小鸟', heat: 1, label: '热门' },
  { rank: 4, title: '小半', heat: 0, label: '' },
  { rank: 5, title: '答案', heat: 0, label: '' },
  { rank: 6, title: '阴天', heat: 0, label: '' },
  { rank: 7, title: '玻璃', heat: 0, label: '' },
  { rank: 8, title: '小島', heat: 0, label: '' },
  { rank: 9, title: '她', heat: 0, label: '' },
  { rank: 10, title: '情歌', heat: 0, label: '' },
];

export const chartTabs = [
  { id: 'hot', label: '热歌榜', icon: 'flame' },
  { id: 'rising', label: '飙升榜', icon: 'trend' },
  { id: 'new', label: '新歌榜', icon: 'new' },
];

export const sourceFilters = ['全部', '网易云', 'QQ音乐', '酷狗', '酷我'];

export const comments = [
  { id: '1', user: '小颉ovo', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop', content: '😔', date: '05/18', location: '四川', likes: 2 },
  { id: '2', user: '李莲花123', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&fit=crop', content: '2', date: '03/19', location: '河北', likes: 0 },
  { id: '3', user: '波哥', avatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=80&h=80&fit=crop', content: '1', date: '03/04', location: '河北', likes: 0 },
];
