const scriptMeta = {
    'wangzuo': { img: 'https://i.postimg.cc/d0cKpGxL/2021-11-13-195627.jpg', badges: ['👥 4男3女', '⏰ 4.5小時', '⭐ 2星'] },
    'beiguo': { img: 'https://i.postimg.cc/yNWMsNFR/01.jpg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 3星'] },
    'bielai': { img: 'https://i.postimg.cc/ZR8GbTTx/image.jpg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 1星'] },
    'fengtian': { img: 'https://i.postimg.cc/W3Z7nM68/image.jpg', badges: ['👥 3男2女', '⏰ 4小時', '⭐ 3星'] },
    'gucheng': { img: 'https://i.postimg.cc/cCsdmcGG/b644a7b3-c9a4-4d08-b36d-c69cc70a0b39-S.png', badges: ['👥 4男3女', '⏰ 4.5小時', '⭐ 2星'] },
    'bingjiao': { img: 'https://i.postimg.cc/RZYbc6pZ/1.jpg', badges: ['👥 7人不限', '⏰ 4-5小時', '⭐ 4星'] },
    'yinyuan': { img: 'https://i.postimg.cc/qqp3BtDL/image.jpg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 2星'] },
    'qingtian': { img: 'https://i.postimg.cc/QMd81msL/image.png', badges: ['👥 4男2女', '⏰ 4小時', '⭐ 0星'] },
    'lichuan': { img: 'https://i.postimg.cc/KvyQtdnC/海報.jpg', badges: ['👥 3男4女', '⏰ 4.5小時', '⭐ 4星'] },
    'nairao': { img: 'https://i.postimg.cc/hjP711CF/image.jpg', badges: ['👥 2男4女', '⏰ 4小時', '⭐ 3星'] },
    'kuaile': { img: 'https://i.postimg.cc/8zDnCPgc/image.jpg', badges: ['👥 2男3女', '⏰ 5小時', '⭐ 1星'] },
    'feiteng': { img: 'https://i.postimg.cc/fyw0htb3/IMG-7198.jpg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 0星'] },
    'muxi': { img: 'https://i.postimg.cc/5twZZZz7/11dacc07-b497-4e5a-9862-9d7cfd0cc80e-S.png', badges: ['👥 4男3女', '⏰ 6小時', '⭐ 5星'] },
    'qunxing': { img: 'https://i.postimg.cc/G3DGXBM5/image.jpg', badges: ['👥 3男3女', '⏰ 5小時', '⭐ 2星'] },
    'anjian': { img: 'https://i.postimg.cc/gJJH0V1F/image.jpg', badges: ['👥 4男3女', '⏰ 4.5小時', '⭐ 3星'] },
    'fengzi2': { img: 'https://i.postimg.cc/W3dHNnnx/image.jpg', badges: ['👥 3男3女', '⏰ 6小時', '⭐ 5星'] },
    'fengqiu': { img: 'https://i.postimg.cc/YqYXV9qH/1742108932-138599662-g-l.jpg', badges: ['👥 3男3女', '⏰ 5小時', '⭐ 4星'] },
    'chunbai': { img: 'https://i.postimg.cc/gjX9pHjJ/image.jpg', badges: ['👥 3男4女', '⏰ 4.5小時', '⭐ 0星'] },
    'chaiqian': { img: 'https://i.postimg.cc/KcVXYpTR/image.jpg', badges: ['👥 5男5女（可反串）', '⏰ 4小時', '⭐ 1星'] },
    'mianmeng': { img: 'https://i.postimg.cc/DwD8FHhJ/2025-09-03-102020.png', badges: ['👥 3男3女', '⏰ 4.5小時', '⭐ 2星'] },
    'nianlun': { img: 'https://i.postimg.cc/L8XcWh1Q/109951165590072847.jpg', badges: ['👥 3男2女', '⏰ 5小時', '⭐ 5星'] },
    'shenle': { img: 'https://i.postimg.cc/JzGNvW45/arch.jpg', badges: ['👥 3男2女', '⏰ 4-5小時', '⭐ 4星'] },
    'chaiqian2': { img: 'https://i.postimg.cc/85kxw6QF/v2-84e72c373c2077e6324e282bd93eba61-1440w.png', badges: ['👥 5男5女（可反串）', '⏰ 4小時', '⭐ 1星'] },
    'jiuda': { img: 'https://i.postimg.cc/1X7LT5c9/2025-08-28-123509.png', badges: ['👥 4男3女（可反串）', '⏰ 4-5小時', '⭐ 3星'] },
    'qingjiang': { img: 'https://i.postimg.cc/wv0KPH3k/1-S-5.jpg', badges: ['👥 3男3女（可反串）', '⏰ 4-5小時', '⭐ 4星'] },
    'fengqi': { img: 'https://i.postimg.cc/XqvNPrvx/image.jpg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 1星'] },
    'bingjiao3': { img: 'https://i.postimg.cc/Gpvg6BBj/image.jpg', badges: ['👥 3男3女', '⏰ 5小時', '⭐ 4星'] },
    'tiancai': { img: 'https://i.postimg.cc/c4gk78LJ/image.png', badges: ['👥 7人（不限性別）', '⏰ 4-5小時', '⭐ 3星'] },
    'taiyang': { img: 'https://i.postimg.cc/sXBRPWRV/image.jpg', badges: ['👥 3男3女', '⏰ 4.5小時', '⭐ 0星'] },
    'zuozuo': { img: 'https://i.postimg.cc/d1ysfhyh/212x300.jpg', badges: ['👥 3男3女（原版7人）', '⏰ 約5小時', '⭐ 4星'] },
    'changchun': { img: 'https://i.postimg.cc/7hgnYWvJ/image.jpg', badges: ['👥 4男2女（可反串）', '⏰ 4小時', '⭐ 3星'] },
    '45': { img: 'https://i.postimg.cc/yYJhpxpr/gto1-Zyy-LPx-DJj-X-KTw-YLkw-Rfk-HCgw2-Dmff-Uk6-Iuh-DMk92fa-X8g0k5ub-Yf-Wa-N-I9-A.jpg', badges: ['👥 4男2女（可反串）', '⏰ 4小時', '⭐ 4星'] },
    'shanglu': { img: 'https://i.postimg.cc/L5CwvkVd/image.jpg', badges: ['👥 2男3女', '⏰ 4小時', '⭐ 4星'] },
    'nihao': { img: 'https://i.postimg.cc/yYHRnqbT/1756965231384-2b83cb44-9f84-4eda-b1a5-1eeeedac38fb-2.jpg', badges: ['👥 3男3女', '⏰ 3-4小時', '⭐ 1星'] },
    'nanjing': { img: 'https://i.postimg.cc/FHhLrJhf/page-0001.jpg', badges: ['👥 5男3女', '⏰ 5小時', '⭐ 4星'] },
    'gaoqian': { img: 'https://i.postimg.cc/Bb2bW6Xn/4x5.png', badges: ['👥 7-10人（可反串）', '⏰ 4-5小時', '⭐ 1星'] },
    'beiji': { img: 'https://i.postimg.cc/zvKbZd9Y/20211010172344555-0134.jpg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 0星'] },
    'sizhe': { img: 'https://i.postimg.cc/LsZ4L32C/image-2-730x1024.png', badges: ['👥 3男3女+1', '⏰ 7小時', '⭐ 5星'] },
    'hezi': { img: 'https://i.postimg.cc/hvs5q3Hj/f7cd87b7-8042-4163-b01c-12a159617662-S-Mr-Boxs-Secret-Store.png', badges: ['👥 4男3女', '⏰ 4小時', '⭐ 4星'] },
    'chongqing': { img: 'https://i.postimg.cc/DyZDgnDN/2025-09-05-154322.png', badges: ['👥 6男2女', '⏰ 5小時', '⭐ 5星'] },
    'wuya': { img: 'https://i.postimg.cc/wB5wB5ZX/1-S.jpg', badges: ['👥 4男2女', '⏰ 5-6小時', '⭐ 4星'] },
    'fengzhong': { img: 'https://i.postimg.cc/L57VYGP5/IMG-7151.jpg', badges: ['👥 3男2女', '⏰ 4小時', '⭐ 3星'] },
    'jingyu': { img: 'https://i.postimg.cc/ZKPLFj52/369-E2-FA6-448-B-4-C9-A-8-A6-E-8-B077276577-B.jpg', badges: ['👥 2男4女', '⏰ 3-4小時', '⭐ 2星'] },
    'wuhuang': { img: 'https://i.postimg.cc/W1T17C8Z/feng-mian1-page-0001.jpg', badges: ['👥 8-9人', '⏰ 4小時', '⭐ 3星'] },
    'wodi': { img: 'https://i.postimg.cc/k4N07QBP/202404241547-031-orig.jpg', badges: ['👥 7人不限', '⏰ 3.5-4小時', '⭐ 4星'] },
    'manhua': { img: 'https://i.postimg.cc/yNpptNdn/202304130041-059.jpg', badges: ['👥 6人', '⏰ 4-5小時', '⭐ 3星'] },
    'xuexiang': { img: 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_1000,w_500,f_auto,q_auto/10858423/158745_191005.jpeg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 3星'] },
    'naesxuwvx0': { img: 'https://i.postimg.cc/SRQ7nsLC/hai-bao1.jpg', badges: ['👥 3男3女', '⏰ 5小時', '⭐ 1星'] },
    'lxe8': { img: 'https://i.postimg.cc/4dxTwvXZ/SKM-C30820072713280-0001.jpg', badges: ['👥 5男3女', '⏰ 5小時', '⭐ 3星'] },
    'fengtuz': { img: '劇本資料/角色海報/《疯兔子》—主海报.jpg', badges: ['👥 3男3女（可反串）', '⏰ 4.5小時', '⭐ 2星'] },
    'chunzhou': { img: 'https://i.postimg.cc/gjX9pHjJ/image.jpg', badges: ['👥 3男3女', '⏰ 4小時', '⭐ 3星'] },
    'jinmen': { img: '', badges: ['👥 4男3女＋捕快', '⏰ 4-5小時', '⭐ 2星'] },
    'jimu2': { img: '', badges: ['👥 4男3女', '⏰ 4-5小時', '⭐ 3星'] },
};

    // 劇本資料
    const scripts = [
        {
            id: 'wangzuo',
            name: '王座',
            players: 7,
            types: ['神話', '陣營', '機制', '新手', '身份轉換'],
            difficulty: 2,
            theme: 'mytho',
            time: 4.5,
            file: '7人/王座.html'
        },
        {
            id: 'beiguo',
            name: '北國之春',
            players: 6,
            types: ['歡樂', '推理', '新手', '情感'],
            difficulty: 3,
            theme: 'history',
            time: 4,
            file: '6人/北國之春.html'
        },
        {
            id: 'bielai',
            name: '別來無恙',
            players: 6,
            types: ['情感', '現代', '新手', '愛情', '校園', '遺憾'],
            difficulty: 1,
            theme: 'love',
            time: 4,
            file: '6人/別來無恙.html'
        },
        {
            id: 'fengtian',
            name: '奉天1928',
            players: 5,
            types: ['情感', '民國', '軍閥', '家國', '沉浸'],
            difficulty: 3,
            theme: 'history',
            time: 4,
            file: '5人/奉天1928.html'
        },
        {
            id: 'gucheng',
            name: '孤城',
            players: 7,
            types: ['陣營', '機制', '情感', '民國', '諜戰'],
            difficulty: 2,
            theme: 'desert',
            time: 4.5,
            file: '7人/孤城.html'
        },
        {
            id: 'bingjiao',
            name: '病嬌男孩的精分日記',
            players: 7,
            types: ['微恐', '還原', '推理', '沉浸'],
            difficulty: 4,
            theme: 'horror',
            time: 4.5,
            file: '7人/病嬌男孩的精分日記.html'
        },
        {
            id: 'yinyuan',
            name: '陰緣',
            players: 6,
            types: ['古風', '情感', '恐怖', '沉浸', '雙主持'],
            difficulty: 2,
            theme: 'ancient',
            time: 4,
            file: '6人/陰緣.html'
        },
        {
            id: 'qingtian',
            name: '晴天神社',
            players: 6,
            types: ['情感', '日式', '沉浸', '還原', '無兇手', '新手'],
            difficulty: 0,
            theme: 'shrine',
            time: 4,
            file: '6人/晴天神社.html'
        },
        {
            id: 'lichuan',
            name: '漓川怪談簿',
            players: 7,
            types: ['日式', '硬核推理', '精怪', '密室', '進階', '還原'],
            difficulty: 4,
            theme: 'mystery',
            time: 4.5,
            file: '7人/漓川怪談簿.html'
        },
        {
            id: 'nairao',
            name: '誰動了我的奶酪',
            players: 6,
            types: ['歡樂', '新手', '童話', '推理', '輕鬆'],
            difficulty: 3,
            theme: 'happy',
            time: 4,
            file: '6人/誰動了我的奶酪.html'
        },
        {
            id: 'kuaile',
            name: '賣快樂的人',
            players: 5,
            types: ['情感', '新手', '沉浸', '立意', '日式', '現代', '無兇手'],
            difficulty: 1,
            theme: 'modern',
            time: 5,
            file: '5人/賣快樂的人.html'
        },
        {
            id: 'feiteng',
            name: '沸騰跨世紀',
            players: 6,
            types: ['歡樂', '新手', '機制', '懷舊', '團建', '無兇手'],
            difficulty: 0,
            theme: 'happy',
            time: 4,
            file: '6人/沸騰跨世紀.html'
        },
        {
            id: 'muxi',
            name: '木夕僧之戲',
            players: 7,
            types: ['日式', '硬核', '變格', '燒腦', '機制', '推理'],
            difficulty: 5,
            theme: 'horror',
            time: 6,
            file: '7人/木夕僧之戲.html'
        },
        {
            id: 'qunxing',
            name: '群星',
            players: 6,
            types: ['機制', '情感', '沉浸', '太空', '新手'],
            difficulty: 2,
            theme: 'space',
            time: 5,
            file: '6人/群星.html'
        },
        {
            id: 'anjian',
            name: '案件重演',
            players: 7,
            types: ['科技', '演繹', '推理', '機制', '歡樂', '還原'],
            difficulty: 3,
            theme: 'modern',
            time: 4.5,
            file: '7人/案件重演.html'
        },
        {
            id: 'fengzi2',
            name: '瘋子2：我將在18歲後分裂成很多人',
            players: 6,
            types: ['日式推理', '變格', '硬核', '進階', '微恐怖', '繁體'],
            difficulty: 5,
            theme: 'horror',
            time: 6,
            file: '6人/瘋子2.html'
        },
        {
            id: 'fengqiu',
            name: '瘋囚於妄念之終',
            players: 6,
            types: ['古風', '驚悚', '變格', '進階', '還原'],
            difficulty: 4,
            theme: 'horror',
            time: 5,
            file: '6人/瘋囚於妄念之終.html'
        },
        {
            id: 'chunbai',
            name: '純白少年的慢性死亡',
            players: 7,
            types: ['懸疑', '病態', '還原', '歡樂', '荒誕', '新手', '無兇手'],
            difficulty: 0,
            theme: 'modern',
            time: 4.5,
            file: '7人/純白少年的慢性死亡.html'
        },
        {
            id: 'chaiqian',
            name: '拆遷',
            players: 10,
            types: ['陣營', '機制', '歡樂', '現代', '撕逼', '新手'],
            difficulty: 1,
            theme: 'modern',
            time: 4,
            file: '8人以上/拆遷.html'
        },
        {
            id: 'mianmeng',
            name: '眠夢不老泉',
            players: 6,
            types: ['情感', '日式', '沉浸', '還原', '新手'],
            difficulty: 2,
            theme: 'shrine',
            time: 4.5,
            file: '6人/眠夢不老泉.html'
        },
        {
            id: 'nianlun',
            name: '年輪',
            players: 5,
            types: ['硬核', '推理', '燒腦', '變格', '現代'],
            difficulty: 5,
            theme: 'mystery',
            time: 5,
            file: '5人/年輪.html'
        },
        {
            id: 'shenle',
            name: '神樂湯',
            players: 5,
            types: ['日式', '硬核', '還原', '推理', '機制'],
            difficulty: 4,
            theme: 'shrine',
            time: 4.5,
            file: '5人/神樂湯.html'
        },
        {
            id: 'chaiqian2',
            name: '拆遷2買房',
            players: 10,
            types: ['續集', '機制', '歡樂', '陣營', '現代', '房產', '博弈'],
            difficulty: 1,
            theme: 'modern',
            time: 4,
            file: '8人以上/拆遷2.html'
        },
        {
            id: 'jiuda',
            name: '酒大奇蹟',
            players: 7,
            types: ['歡樂', '未來', '機制', '酒文化', '科幻', '特殊', '沉浸'],
            difficulty: 3,
            theme: 'space',
            time: 4.5,
            file: '7人/酒大奇蹟.html'
        },
        {
            id: 'qingjiang',
            name: '請將我深埋',
            players: 6,
            types: ['日式', '推理', '還原', '硬核', '情感', '懸疑', '進階'],
            difficulty: 4,
            theme: 'modern',
            time: 4.5,
            file: '6人/請將我深埋.html'
        },
        {
            id: 'fengqi',
            name: '風起時想你',
            players: 6,
            types: ['情感', '現代', '沉浸', '愛情', '新手'],
            difficulty: 1,
            theme: 'love',
            time: 4,
            file: '6人/風起時想你.html'
        },
        {
            id: 'bingjiao3',
            name: '病嬌3：近乎正常的我們',
            players: 6,
            types: ['微恐', '還原', '推理', '沉浸', '進階'],
            difficulty: 4,
            theme: 'horror',
            time: 5,
            file: '6人/病嬌3近乎正常的我們.html'
        },
        {
            id: 'tiancai',
            name: '天才在左我在右',
            players: 7,
            types: ['現代', '推理', '本格', '還原', '硬核', '微恐', '繁體'],
            difficulty: 3,
            theme: 'mystery',
            time: 4.5,
            file: '7人/天才在左我在右.html'
        },
        {
            id: 'taiyang',
            name: '太陽可以是藍色嗎',
            players: 6,
            types: ['現代', '情感', '純愛', '浪漫', '無兇手'],
            difficulty: 0,
            theme: 'modern',
            time: 4.5,
            file: '6人/太陽可以是藍色嗎.html'
        },
        {
            id: 'zuozuo',
            name: '左左',
            players: 6,
            types: ['現代', '驚悚', '還原', '獵奇', '沉浸', '微恐', '繁體', '城限'],
            difficulty: 4,
            theme: 'horror',
            time: 5,
            file: '6人/左左.html'
        },
        {
            id: 'changchun',
            name: '常春藤公寓',
            players: 6,
            types: ['本格', '推理', '還原', '微恐', '現代', '架空', '新手友善', '繁化'],
            difficulty: 3,
            theme: 'mystery',
            time: 4,
            file: '6人/常春藤公寓.html'
        },
        {
            id: '45',
            name: '45',
            players: 6,
            types: ['推理', '本格', '現代', '微恐', '還原', '新手友善', '進階可玩', '繁化'],
            difficulty: 4,
            theme: 'mystery',
            time: 4,
            file: '6人/45.html'
        },
        {
            id: 'shanglu',
            name: '上路',
            players: 5,
            types: ['現代', '恐怖', '硬核', '還原', '變格', '進階', '繁體'],
            difficulty: 4,
            theme: 'horror',
            time: 4,
            file: '5人/上路.html'
        },
        {
            id: 'nihao',
            name: '你好',
            players: 6,
            types: ['現代', '情感', '沉浸', '治癒', '還原', '本格'],
            difficulty: 1,
            theme: 'love',
            time: 3.5,
            file: '6人/你好.html'
        },
        {
            id: 'nanjing',
            name: '諜影南京風沙',
            players: 8,
            types: ['民國', '陣營', '諜戰', '還原', '本格'],
            difficulty: 4,
            theme: 'history',
            time: 5,
            file: '8人以上/南京風沙.html'
        },
        {
            id: 'gaoqian',
            name: '搞錢',
            players: 10,
            types: ['歡樂', '機制', '陣營', '現代', '商戰'],
            difficulty: 1,
            theme: 'happy',
            time: 4.5,
            file: '8人以上/搞錢.html'
        },
        {
            id: 'beiji',
            name: '放棄生活去北極',
            players: 6,
            types: ['日式', '情感', '立意', '治癒', '新手', '機制', '歡樂', '沉浸'],
            difficulty: 0,
            theme: 'shrine',
            time: 4,
            file: '6人/放棄生活去北極.html'
        },
        {
            id: 'sizhe',
            name: '死者在幻夜中醒來',
            players: 7,
            types: ['日式', '硬核', '推理', '還原', '詭計', '燒腦', '進階'],
            difficulty: 5,
            theme: 'mystery',
            time: 7,
            file: '7人/死者在幻夜中醒來.html'
        },
        {
            id: 'hezi',
            name: '盒子先生的秘密商店',
            players: 7,
            types: ['現代', '驚悚', '還原', '硬核', '獵奇', '心理', '進階'],
            difficulty: 4,
            theme: 'horror',
            time: 4,
            file: '7人/盒子先生的秘密商店.html'
        },
        {
            id: 'chongqing',
            name: '諜影重慶迷霧',
            players: 8,
            types: ['諜戰', '硬核', '推理', '還原', '陣營', '本格'],
            difficulty: 5,
            theme: 'mystery',
            time: 5,
            file: '8人以上/重慶迷霧.html'
        },
        {
            id: 'wuya',
            name: '霧鴉館',
            players: 6,
            types: ['現代', '架空', '恐怖', '硬核', '密室', '變格'],
            difficulty: 4,
            theme: 'horror',
            time: 5.5,
            file: '6人/霧鴉館.html'
        },
        {
            id: 'fengzhong',
            name: '風中有朵雨做的雲',
            players: 5,
            types: ['港風', '迪廳', '微恐', '情感', '推理', '沉浸'],
            difficulty: 3,
            theme: 'modern',
            time: 4,
            file: '5人/風中有朵雨做的雲.html'
        },
        {
            id: 'jingyu',
            name: '鯨魚馬戲團',
            players: 6,
            types: ['情感', '溫情', '新手', '還原'],
            difficulty: 2,
            theme: 'space',
            time: 3.5,
            file: '6人/鯨魚馬戲團.html'
        }
    ];
    // 追加新增四個劇本的映射
    scripts.push(
        {
            id: 'wuhuang',
            name: '吾皇在上',
            players: 8,
            types: ['宮鬥', '歡樂', '推理', '角色扮演', '古風', '陣營', '機制', '新手'],
            difficulty: 3,
            theme: 'ancient',
            time: 4,
            file: '8人以上/吾皇在上.html'
        },
        {
            id: 'wodi',
            name: '臥底模擬訓練',
            players: 7,
            types: ['硬核', '推理', '新手友善', '警匪', '現代'],
            difficulty: 4,
            theme: 'modern',
            time: 4,
            file: '7人/臥底模擬訓練.html'
        },
        {
            id: 'manhua',
            name: '漫畫裡的小黑人',
            players: 6,
            types: ['歡樂', '還原', '童話', '機制', '新手友善'],
            difficulty: 3,
            theme: 'happy',
            time: 4.5,
            file: '6人/漫畫裡的小黑人.html'
        },
        {
            id: 'xuexiang',
            name: '雪鄉連環殺人事件',
            players: 6,
            types: ['驚悚', '微恐', '演繹', '推理', '還原'],
            difficulty: 3,
            theme: 'horror',
            time: 4,
            file: '6人/雪鄉連環殺人事件.html'
        },
        {
            id: 'naesxuwvx0',
            name: '那一束月光',
            players: 6,
            types: ['現代', '情感', '歡樂', '戀綜', '無推理', '新手友善'],
            difficulty: 1,
            theme: 'love',
            time: 5,
            file: '6人/那一束月光.html'
        },
        {
            id: 'lxe8',
            name: '龍宴',
            players: 8,
            types: ['古裝', '宮廷', '推理', '陣營', '機制'],
            difficulty: 3,
            theme: 'horror',
            time: 5,
            file: '8人以上/龍宴.html'
        },
        {
            id: 'fengtuz',
            name: '瘋兔子，白又白，砍下腦袋飛起來',
            players: 6,
            types: ['架空', '還原', '驚悚', '怪談', '新手'],
            difficulty: 2,
            theme: 'horror',
            time: 4.5,
            file: '6人/瘋兔子白又白砍下腦袋飛起來.html'
        },
        {
            id: 'chunzhou',
            name: '春昼短',
            players: 6,
            types: ['現代', '情感', '沉浸', '治癒', '進階'],
            difficulty: 3,
            theme: 'love',
            time: 4,
            file: '6人/春昼短.html'
        },
        {
            id: 'jinmen',
            name: '津門遺雲',
            players: 8,
            types: ['民國', '歡樂', '嘴砲', '陣營', '新手'],
            difficulty: 2,
            theme: 'history',
            time: 4.5,
            file: '8人以上/津門遺雲.html'
        },
        {
            id: 'jimu2',
            name: '極目2：九爺！我想給您養老',
            players: 7,
            types: ['民國', '歡樂', '陣營', '機制', '本格'],
            difficulty: 3,
            theme: 'history',
            time: 4.5,
            file: '7人/極目2九爺我想給您養老.html'
        },
    );

    // DOM載入後執行的初始化函式
    document.addEventListener('DOMContentLoaded', () => {
        renderCards();
        // 綁定篩選事件監聽
        document.getElementById('playerFilter').addEventListener('change', () => {
            updateAvailableOptions();
            filterScripts();
        });
        document.getElementById('typeFilter').addEventListener('change', () => {
            updateAvailableOptions();
            filterScripts();
        });
        document.getElementById('difficultyFilter').addEventListener('change', () => {
            updateAvailableOptions();
            filterScripts();
        });
        
        // 綁定搜索事件監聽
        document.getElementById('searchInput').addEventListener('input', () => {
            filterScripts();
        });
        
        // 綁定排序事件監聽
        document.getElementById('sortFilter').addEventListener('change', () => {
            sortScripts();
        });
        
        // 初始化可用選項和篩選
        updateAvailableOptions();
        filterScripts();
        applyStaggerAnimationWithinTwoSeconds();
    });
    
    // 更新可用選項的函式
    function updateAvailableOptions() {
        const playerFilter = document.getElementById('playerFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const difficultyFilter = document.getElementById('difficultyFilter').value;
        
        // 根據當前篩選條件找出符合的劇本
        let filteredScripts = scripts.filter(script => {
            let match = true;
            if (playerFilter && script.players != playerFilter) match = false;
            if (typeFilter && !script.types.includes(typeFilter)) match = false;
            if (difficultyFilter && script.difficulty != difficultyFilter) match = false;
            return match;
        });
        
        // 更新人數選項
        updatePlayerOptions(filteredScripts, typeFilter, difficultyFilter);
        
        // 更新類型選項
        updateTypeOptions(filteredScripts, playerFilter, difficultyFilter);
        
        // 更新難度選項
        updateDifficultyOptions(filteredScripts, playerFilter, typeFilter);
        
        // 更新篩選結果數量
        updateFilteredCount(filteredScripts.length);
    }
    
    // 更新人數選項
    function updatePlayerOptions(baseScripts, typeFilter, difficultyFilter) {
        const playerSelect = document.getElementById('playerFilter');
        const currentValue = playerSelect.value;
        
        // 找出在其他條件下可用的人數
        let availablePlayers = new Set();
        scripts.forEach(script => {
            let match = true;
            if (typeFilter && !script.types.includes(typeFilter)) match = false;
            if (difficultyFilter && script.difficulty != difficultyFilter) match = false;
            if (match) {
                availablePlayers.add(script.players);
            }
        });
        
        // 更新選項
        const options = playerSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === '') return; // 保留"全部人數"選項
            const playerCount = parseInt(option.value);
            if (availablePlayers.has(playerCount)) {
                option.style.display = 'block';
                option.disabled = false;
            } else {
                option.style.display = 'none';
                option.disabled = true;
            }
        });
        
        // 如果當前選擇的選項不可用，清空選擇
        if (currentValue && !availablePlayers.has(parseInt(currentValue))) {
            playerSelect.value = '';
        }
    }
    
    // 更新類型選項
    function updateTypeOptions(baseScripts, playerFilter, difficultyFilter) {
        const typeSelect = document.getElementById('typeFilter');
        const currentValue = typeSelect.value;
        
        // 找出在其他條件下可用的類型
        let availableTypes = new Set();
        scripts.forEach(script => {
            let match = true;
            if (playerFilter && script.players != playerFilter) match = false;
            if (difficultyFilter && script.difficulty != difficultyFilter) match = false;
            if (match) {
                script.types.forEach(type => availableTypes.add(type));
            }
        });
        
        // 更新選項
        const options = typeSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === '') return; // 保留"全部類型"選項
            if (availableTypes.has(option.value)) {
                option.style.display = 'block';
                option.disabled = false;
            } else {
                option.style.display = 'none';
                option.disabled = true;
            }
        });
        
        // 如果當前選擇的選項不可用，清空選擇
        if (currentValue && !availableTypes.has(currentValue)) {
            typeSelect.value = '';
        }
    }
    
    // 更新難度選項
    function updateDifficultyOptions(baseScripts, playerFilter, typeFilter) {
        const difficultySelect = document.getElementById('difficultyFilter');
        const currentValue = difficultySelect.value;
        
        // 找出在其他條件下可用的難度
        let availableDifficulties = new Set();
        scripts.forEach(script => {
            let match = true;
            if (playerFilter && script.players != playerFilter) match = false;
            if (typeFilter && !script.types.includes(typeFilter)) match = false;
            if (match) {
                availableDifficulties.add(script.difficulty);
            }
        });
        
        // 更新選項
        const options = difficultySelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === '') return; // 保留"全部難度"選項
            const difficulty = parseInt(option.value);
            if (availableDifficulties.has(difficulty)) {
                option.style.display = 'block';
                option.disabled = false;
            } else {
                option.style.display = 'none';
                option.disabled = true;
            }
        });
        
        // 如果當前選擇的選項不可用，清空選擇
        if (currentValue && !availableDifficulties.has(parseInt(currentValue))) {
            difficultySelect.value = '';
        }
    }

    // 解析 CSS 時間字串為秒數（支援 s / ms）
    function parseCssTimeToSeconds(timeString) {
        if (!timeString) return 0;
        const first = String(timeString).split(',')[0].trim();
        if (first.endsWith('ms')) return parseFloat(first) / 1000;
        if (first.endsWith('s')) return parseFloat(first);
        const val = parseFloat(first);
        return isNaN(val) ? 0 : val;
    }

    // 將可見的卡片動畫錯開時間壓縮在 2 秒內完成顯示
    function applyStaggerAnimationWithinTwoSeconds() {
        const container = document.getElementById('scriptsGrid');
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('.script-card'));
        const visibleCards = cards.filter(card => !card.classList.contains('hidden'));
        if (visibleCards.length === 0) return;

        const durationSec = parseCssTimeToSeconds(getComputedStyle(visibleCards[0]).animationDuration);
        const maxTotalSec = 2; // 最晚在 2 秒內完成（含動畫本身的時間）
        const latestStartSec = Math.max(0, maxTotalSec - durationSec);
        const stepSec = visibleCards.length > 1 ? (latestStartSec / (visibleCards.length - 1)) : 0;

        visibleCards.forEach((card, index) => {
            card.style.animationDelay = (index * stepSec).toFixed(3) + 's';
            card.style.animationPlayState = 'running';
        });
    }

    // 篩選功能
    function filterScripts() {
        const playerFilter = document.getElementById('playerFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const difficultyFilter = document.getElementById('difficultyFilter').value;
        const searchQuery = document.getElementById('searchInput').value.toLowerCase();
        
        const scriptCards = document.querySelectorAll('.script-card');
        const noResultsEl = document.getElementById('noResults');
        let visibleCount = 0;

        scriptCards.forEach(card => {
            const players = card.dataset.players;
            const types = card.dataset.types.split(',');
            const difficulty = card.dataset.difficulty;
            const title = card.querySelector('.script-title').textContent.toLowerCase();
            
            let shouldShow = true;
            if (playerFilter && players !== playerFilter) {
                shouldShow = false;
            }
            if (typeFilter && !types.includes(typeFilter)) {
                shouldShow = false;
            }
            if (difficultyFilter && difficulty !== difficultyFilter) {
                shouldShow = false;
            }
            if (searchQuery && !title.includes(searchQuery)) {
                shouldShow = false;
            }
            
            if (shouldShow) {
                card.classList.remove('hidden');
                visibleCount++;
            } else {
                card.classList.add('hidden');
            }
        });

        // 根據 visibleCount 決定是否顯示 "查無結果"
        if (visibleCount === 0) {
            noResultsEl.classList.remove('hidden');
        } else {
            noResultsEl.classList.add('hidden');
        }
        
        // 更新篩選結果數量
        updateFilteredCount(visibleCount);
        // 重新計算動畫延遲，確保可見卡片在 2 秒內完成顯示
        applyStaggerAnimationWithinTwoSeconds();
    }

    // 更新篩選結果數量
    function updateFilteredCount(count) {
        const filteredCountEl = document.getElementById('filteredCount');
        if (filteredCountEl) {
            filteredCountEl.textContent = count;
        }
    }

    // 重置篩選函式
    function resetFilters() {
        document.getElementById('playerFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('difficultyFilter').value = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('sortFilter').value = 'default';
        updateAvailableOptions();
        filterScripts();
        sortScripts();
    }

    // 前往指定頁面的函式
    function goToPage(filename) {
        window.location.href = filename;
    }

    // 排序功能
    function sortScripts() {
        const sortType = document.getElementById('sortFilter').value;
        const scriptCards = Array.from(document.querySelectorAll('.script-card:not(.hidden)'));
        const scriptsGrid = document.getElementById('scriptsGrid');
        
        if (sortType === 'default') {
            // 恢復原始順序
            scriptCards.forEach(card => {
                scriptsGrid.appendChild(card);
            });
            return;
        }
        
        scriptCards.sort((a, b) => {
            switch (sortType) {
                case 'name':
                    const nameA = a.querySelector('.script-title').textContent;
                    const nameB = b.querySelector('.script-title').textContent;
                    return nameA.localeCompare(nameB, 'zh-TW');
                    
                case 'difficulty':
                    const diffA = parseInt(a.dataset.difficulty);
                    const diffB = parseInt(b.dataset.difficulty);
                    return diffA - diffB;
                    
                case 'time':
                    const timeA = parseFloat(a.querySelector('.info-badge:nth-child(2)').textContent.replace('⏰ ', '').replace('小時', ''));
                    const timeB = parseFloat(b.querySelector('.info-badge:nth-child(2)').textContent.replace('⏰ ', '').replace('小時', ''));
                    return timeA - timeB;
                    
                case 'players':
                    const playersA = parseInt(a.dataset.players);
                    const playersB = parseInt(b.dataset.players);
                    return playersA - playersB;
                    
                default:
                    return 0;
            }
        });
        
        // 重新排列卡片
        scriptCards.forEach(card => {
            scriptsGrid.appendChild(card);
        });
        // 重新計算動畫延遲，確保可見卡片在 2 秒內完成顯示
        applyStaggerAnimationWithinTwoSeconds();
    }

    // 前往劇本詳細頁面的函式
    function goToScript(scriptId) {
        const script = scripts.find(s => s.id === scriptId);
        if (script && script.file) {
            window.location.href = script.file;
        } else {
            console.error('找不到ID為 ' + scriptId + ' 的劇本檔案。');
            alert('抱歉，找不到該劇本的詳細介紹頁面。');
        }
    }

// Dynamically generate card DOM from scripts data
function renderCards() {
    const grid = document.getElementById('scriptsGrid');
    if (!grid) return;
    grid.innerHTML = scripts.map(s => {
        const m      = scriptMeta[s.id] || {};
        const img    = m.img || '';
        const badges = (m.badges || []).map(b => `<span class="info-badge">${b}</span>`).join('');
        const types  = s.types.map(t => `<span class="type-tag">${t}</span>`).join('');
        return `<article class="script-card" data-theme="${s.theme}" data-players="${s.players}" data-types="${s.types.join(',')}" data-difficulty="${s.difficulty}">
            <div class="card-media">
                <img src="${img}" alt="${s.name}" class="script-image" loading="lazy">
                <span class="corner-diff">${s.players}人</span>
            </div>
            <div class="card-body">
                <h3 class="script-title">${s.name}</h3>
                <div class="script-info">${badges}</div>
                <div class="script-types">${types}</div>
                <button class="detail-btn" onclick="goToScript('${s.id}')">查看詳情 →</button>
            </div>
        </article>`;
    }).join('\n');
}
