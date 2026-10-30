// All UI strings. Default language: English. Selector persists choice.
const I18N = {
  en: { title:"Fruit Merge", best:"Best", gameOver:"Game Over", score:"Score",
        newBest:"New best!", paused:"Paused", combo:"Combo", continue:"Continue?",
        reviveText:"Watch an ad to clear the big fruit.", watchAd:"Watch ad",
        endRun:"End run", testAd:"Test ad", rights:"All rights reserved." },
  ka: { title:"ხილის შერწყმა", best:"რეკორდი", gameOver:"თამაში დამთავრდა", score:"ქულა",
        newBest:"ახალი რეკორდი!", paused:"პაუზა", combo:"სერია", continue:"გაგრძელება?",
        reviveText:"უყურე რეკლამას და დიდი ხილი გაქრება.", watchAd:"რეკლამის ნახვა",
        endRun:"დასრულება", testAd:"სატესტო რეკლამა", rights:"ყველა უფლება დაცულია." },
  ru: { title:"Слияние фруктов", best:"Рекорд", gameOver:"Игра окончена", score:"Очки",
        newBest:"Новый рекорд!", paused:"Пауза", combo:"Комбо", continue:"Продолжить?",
        reviveText:"Посмотрите рекламу, чтобы убрать крупные фрукты.", watchAd:"Смотреть рекламу",
        endRun:"Завершить", testAd:"Тестовая реклама", rights:"Все права защищены." },
  zh: { title:"合成水果", best:"最高分", gameOver:"游戏结束", score:"分数",
        newBest:"新纪录！", paused:"暂停", combo:"连击", continue:"继续游戏？",
        reviveText:"观看广告即可清除大水果。", watchAd:"观看广告",
        endRun:"结束游戏", testAd:"测试广告", rights:"版权所有。" },
  ja: { title:"フルーツマージ", best:"ベスト", gameOver:"ゲームオーバー", score:"スコア",
        newBest:"新記録！", paused:"一時停止", combo:"コンボ", continue:"続けますか？",
        reviveText:"広告を見ると大きなフルーツが消えます。", watchAd:"広告を見る",
        endRun:"終了する", testAd:"テスト広告", rights:"すべての権利を保留します。" }
};
let LANG = localStorage.getItem("fm_lang") || "en";
if (!I18N[LANG]) LANG = "en";
function T(key) { return I18N[LANG][key] || I18N.en[key]; }
