(function () {
    'use strict';

    const FORM_SCRIPTS = [
        { page: 1, value: '群星', entry: '466317015', roles: ['馬斯克', '貝斯', '伊萬', '索菲亞', '張北斗', '達莉婭'] },
        { page: 2, value: '病嬌男孩的精分日記', entry: '1408349206', roles: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期天'] },
        { page: 3, value: '北國之春', entry: '2098672661', roles: ['鮑里斯', '康斯坦丁', '維克多', '索菲亞', '娜塔莉', '尤里希'] },
        { page: 4, value: '孤城', entry: '659475103', roles: ['麗麗娜伊', '鐵男', '陳懷安', '柳湘人', '蔣古城', '樓小蘭', '夜神'] },
        { page: 5, value: '奉天1928', entry: '348164220', roles: ['董晴', '董至夷', '馮昊', '魏聞聲', '赫連珊'] },
        { page: 6, value: '晴天神社', entry: '822038608', roles: ['木村聖也', '清水琉奈', '秋元英樹', '長澤龍之介', '小野光夫', '木村一郎'] },
        { page: 7, value: '賣快樂的人', entry: '226177726', roles: ['偷月亮的人', '靜止的人', '藍色的人', '霧氣騰騰的人', '踩影子的人'] },
        { page: 8, value: '別來無恙', entry: '132867987', roles: ['陳久然', '李斯哲', '簡珩', '夏然', '梁白', '顧夢嬌'] },
        { page: 9, value: '誰動了我的奶酪', entry: '1806553520', roles: ['黑髮少女', '小男孩', '啞吧姑娘', '金髮少女', '小女孩', '鬍子叔叔'] },
        { page: 10, value: '木夕僧之戲', entry: '1183623682', roles: ['月讀千鶴', '般若彌生', '不破秋波', '天照櫻和', '明智春光', '大塚敬公', '安倍偵探'] },
        { page: 11, value: '案件重演', entry: '1704762096', roles: ['劉天宇', '梁良', '白鷺', '霍長生', '唐琪', '謝思妍', '盧峰'] },
        { page: 12, value: '沸騰跨世紀', entry: '28567220', roles: ['包義峰', '吳麗', '劉洪濤', '高巧燕', '馬占山', '張雲娟'] },
        { page: 13, value: '漓川怪談簿', entry: '710331478', roles: ['青衣女子', '紅衣女子', '黑衣少年', '白衣少女', '繃帶怪人', '小女孩', '衣衫襤褸的老人'] },
        { page: 14, value: '王座', entry: '1537194380', roles: ['芬里爾', '海姆達爾', '弗麗嘉', '托爾', '洛基', '瓦基里', '希芙'] },
        { page: 15, value: '瘋囚於妄念之終', entry: '766001925', roles: ['烏顏', '唐小冉', '宋清秋', '沈煥', '鄭學林', '顧青杉'] },
        { page: 16, value: '瘋子2我將在18歲後分裂成很多人', label: '瘋子2：我將在18歲後分裂成很多人', entry: '1540118238', roles: ['大蛇', '鋼筆', '櫻', '兔子', '可樂', '夫人'] },
        { page: 17, value: '純白少年的慢性死亡', entry: '1028810359', roles: ['紅色', '橙色', '黃色', '綠色', '青色', '藍色', '紫色'] },
        { page: 18, value: '陰緣', entry: '475291440', roles: ['李天青', '李康節', '程遠常', '程小宛', '海棠', '夏雲煙'] },
        { page: 19, value: '拆遷', entry: '652326695', roles: ['劉米飯', '周廣播', '孫小美', '張論文', '林軟軟', '王大炮', '鄭老蔫', '鄭高考', '宋美容', '趙尖果'] },
        { page: 20, value: '眠夢不老泉', entry: '794154688', roles: ['阿杉', '邦迪', '伊伊', '達文西', '蜜兒', '小喬'] },
        { page: 21, value: '年輪', entry: '898211869', roles: ['劉伯釗', '陳爍', '姚波', '袁本', '王小冉'] },
        { page: 22, value: '神樂湯', entry: '1471974723', roles: ['螃蟹', '青蛙', '黑魚', '甲魚', '豚豚'] },
        { page: 23, value: '拆遷2買房', entry: '535476874', roles: ['董大爺', '周廣播', '武貝勒', '陳小民', '陳大寶', '賈倒騰', '趙仲介', '朱翡翠', '劉小曼', '王二姐'] },
        { page: 24, value: '酒大奇蹟', entry: '1790570548', roles: ['查理', '羅婆婆', '逆火', '華生', '周念', '盧致標', '鄧圓順'] },
        { page: 25, value: '請將我深埋', entry: '1063102104', roles: ['藤原子蛟', '酒井藝', '高木折浩', '高海敏', '森田木果', '小野可可'] },
        { page: 26, value: '風起時想你', entry: '921955528', roles: ['林碩', '陳煜', '白榆', '沈念', '顧薇', '楊若楠'] },
        { page: 27, value: '病嬌3近乎正常的我們', label: '病嬌3：近乎正常的我們', entry: '967486147', roles: ['星期二', '星期三', '星期四', '星期五', '星期六', '星期日'] },
        { page: 28, value: '天才在左我在右', entry: '1264101826', roles: ['偽面者', '獵心師', '低語者', '匿行者', '築夢師', '犧牲者', '執刑者'] },
        { page: 29, value: '太陽可以是藍色嗎', entry: '817784930', roles: ['清遙', '步含光', '胡蝶', '池森', '余朝', '初見'] },
        { page: 30, value: '左左', entry: '497377796', roles: ['1', '2', '3', '4', '5', '6'] },
        { page: 31, value: '常春藤公寓', entry: '2092770057', roles: ['星期一', '星期二', '星期四', '星期五', '星期六', '星期天'] },
        { page: 32, value: '45', entry: '1316386441', roles: ['李瀚明', '林明', '秦蒼', '秦花語', '楊星彩', '張耀雲'] },
        { page: 33, value: '鯨魚馬戲團', entry: '1395881663', roles: ['天天', '雲雲', '圓圓', '落落', '飛飛', '萱萱'] },
        { page: 34, value: '拆遷2', entry: '1383539839', roles: ['董大爺', '周廣播', '武貝勒', '陳小民', '陳大寶', '賈倒騰', '趙仲介', '朱翡翠', '劉小曼', '王二姐'] },
        { page: 35, value: '放棄生活去北極', entry: '1487308559', roles: ['木木警官', '娘口三三', '佐藤', '方向盤', '絕緣體', '3.14159'] },
        { page: 36, value: '上路', entry: '1882240655', roles: ['達澤明', '張雅文', '阿花', '張卓君', '達雯菁'] },
        { page: 37, value: '搞錢', entry: '393396970', roles: ['林笑', '趙行遠', '董建國', '瑟琳娜', '藤原凌', '齊梅', '白如鏡', '鄭義', '李民俊', '賈仁君'] },
        { page: 38, value: '霧鴉館', entry: '412226549', roles: ['陽光帥氣男生', '綁著繃帶男子', '黑瘦中年男人', '微胖婦女', '幹練短髮女人', '儒雅眼鏡男子'] },
        { page: 39, value: '你好', entry: '472691014', roles: ['李海澤', '阿瑤', '夏雲峥', '于婉兒', '梁梓奕', '林墨'] },
        { page: 40, value: '重慶迷霧', entry: '1933647602', roles: ['張敬佑', '秦詩琪', '余笑笑', '左鋒', '黎旭', '文國俊', '曾強', '王志華'] },
        { page: 41, value: '南京風沙', entry: '337432535', roles: ['安軍', '鄧萍萍', '歐陽澤', '劉宗錫', '羅文和', '秦晴', '周毅剛', '杜安嵐'] },
        { page: 42, value: '盒子先生的秘密商店', entry: '1590328308', roles: ['BE大師', '主角光環', '正常人類', '逆旅人生', '童年味道', '江郎才盡', '靈魂畫手'] },
        { page: 43, value: '風中有朵雨做的雲', entry: '1240469760', roles: ['陳韻', '劉飛宇', '張龍', '蘇金巧', '李曉峯'] },
        { page: 44, value: '死者在幻夜中醒來', entry: '1015267095', roles: ['戴著面具的人', '青年女人', '臉上帶痣的中年女人', '長髮中年女子', '小男孩', '年輕男人', '中年男人'] },
        { page: 45, value: '雪鄉連環殺人事件', entry: '1280247790', roles: ['陳吉', '卓司元', '崔鎧強', '李開心', '蕭萌', '王琪'] },
        { page: 46, value: '臥底模擬訓練', entry: '1674841261', roles: ['東哥', '小北', '飯焦', '細叔', '豬標', '華仔', '民哥'] },
        { page: 47, value: '漫畫裡的小黑人', entry: '815397190', roles: ['毛利小次郎', '中華大當家', '賽華陀', '東門慶', '洪興陳好難', '芳心縱火犯'] },
        { page: 48, value: '吾皇在上', entry: '1576120206', roles: ['李諳', '金統領', '林老公公', '小卓子', '劉貴妃', '咖貴人', '王貴人', '侍女環兒', '王太醫'] }
    ];

    const form = document.getElementById('playRecordForm');
    const scriptSelect = document.getElementById('scriptSelect');
    const scriptValue = document.getElementById('scriptValue');
    const pageHistory = document.getElementById('pageHistory');
    const roleField = document.getElementById('roleField');
    const roleLegend = document.getElementById('roleLegend');
    const roleOptions = document.getElementById('roleOptions');
    const roleLoadStatus = document.getElementById('roleLoadStatus');
    const playDate = document.getElementById('playDate');
    const playerName = document.getElementById('playerName');
    const comment = document.getElementById('comment');
    const commentCount = document.getElementById('commentCount');
    const formStatus = document.getElementById('formStatus');
    const submitButton = document.getElementById('submitButton');
    const iframe = document.getElementById('googleFormTarget');
    const successPanel = document.getElementById('successPanel');
    const addAnotherButton = document.getElementById('addAnotherButton');
    const configByValue = new Map(FORM_SCRIPTS.map((script) => [script.value, script]));

    let submissionPending = false;
    let submissionCompleted = false;
    let successTimer = null;

    FORM_SCRIPTS.forEach((script) => {
        const option = document.createElement('option');
        option.value = script.value;
        option.textContent = script.label || script.value;
        scriptSelect.appendChild(option);
    });

    function getLocalDateString() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 10);
    }

    function setDefaultDate() {
        const today = getLocalDateString();
        playDate.max = today;
        if (!playDate.value) playDate.value = today;
    }

    function showError(message) {
        formStatus.textContent = message;
        formStatus.hidden = false;
    }

    function clearError() {
        formStatus.textContent = '';
        formStatus.hidden = true;
    }

    function resetRoleChoices() {
        roleField.disabled = true;
        roleLegend.textContent = '飾演的角色 *';
        roleOptions.replaceChildren();
        const placeholder = document.createElement('p');
        placeholder.className = 'role-placeholder';
        placeholder.textContent = '先選擇劇本，這裡就會出現角色。';
        roleOptions.appendChild(placeholder);
        roleLoadStatus.textContent = '尚未選擇劇本';
        roleLoadStatus.classList.remove('ready');
        scriptValue.value = '';
        pageHistory.value = '0';
    }

    function renderRoleChoices(script) {
        roleOptions.replaceChildren();
        roleLegend.textContent = `《${script.label || script.value}》飾演的角色 *`;

        script.roles.forEach((role, index) => {
            const label = document.createElement('label');
            label.className = 'role-choice';

            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `role-${script.entry}-${index}`;
            input.name = `entry.${script.entry}`;
            input.value = role;
            input.required = true;

            const text = document.createElement('span');
            text.textContent = role;

            label.append(input, text);
            roleOptions.appendChild(label);
        });

        roleField.disabled = false;
        scriptValue.value = script.value;
        pageHistory.value = `0,${script.page}`;
        roleLoadStatus.textContent = `已載入 ${script.roles.length} 個角色選項`;
        roleLoadStatus.classList.add('ready');
    }

    scriptSelect.addEventListener('change', () => {
        clearError();
        const script = configByValue.get(scriptSelect.value);
        if (script) renderRoleChoices(script);
        else resetRoleChoices();
    });

    comment.addEventListener('input', () => {
        commentCount.textContent = `${comment.value.length} / 50`;
    });

    function prepareDateFields() {
        const [year, month, day] = playDate.value.split('-');
        document.getElementById('dateYear').value = year || '';
        document.getElementById('dateMonth').value = month ? String(Number(month)) : '';
        document.getElementById('dateDay').value = day ? String(Number(day)) : '';
    }

    function completeSubmission() {
        if (!submissionPending || submissionCompleted) return;
        submissionCompleted = true;
        clearTimeout(successTimer);
        form.hidden = true;
        successPanel.hidden = false;
        successPanel.focus();
    }

    iframe.addEventListener('load', completeSubmission);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearError();

        if (navigator.onLine === false) {
            showError('目前沒有網路連線。請連線後再送出，避免記錄遺失。');
            return;
        }

        const script = configByValue.get(scriptSelect.value);
        if (!script) {
            showError('請先選擇玩過的劇本。');
            scriptSelect.focus();
            return;
        }

        if (playDate.value > playDate.max) {
            showError('遊玩日期不能晚於今天。');
            playDate.focus();
            return;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            showError('還有必填欄位尚未完成，請檢查後再送出。');
            return;
        }

        prepareDateFields();
        try {
            localStorage.setItem('starfishlarp-player-name', playerName.value.trim());
        } catch (_) {
            // Private browsing may disable localStorage; submission can continue.
        }

        submissionPending = true;
        submissionCompleted = false;
        submitButton.disabled = true;
        submitButton.querySelector('span').textContent = '正在送出…';

        form.submit();
        successTimer = setTimeout(completeSubmission, 10000);
    });

    addAnotherButton.addEventListener('click', () => {
        const savedName = playerName.value;
        form.reset();
        resetRoleChoices();
        commentCount.textContent = '0 / 50';
        clearError();
        setDefaultDate();
        playerName.value = savedName;
        submitButton.disabled = false;
        submitButton.querySelector('span').textContent = '送出玩本記錄';
        submissionPending = false;
        submissionCompleted = false;
        successPanel.hidden = true;
        form.hidden = false;
        scriptSelect.focus();
    });

    setDefaultDate();
    try {
        playerName.value = localStorage.getItem('starfishlarp-player-name') || '';
    } catch (_) {
        // Remembering the name is optional.
    }
})();
