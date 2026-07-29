// アンブシュア確認チェックリストの静的定義 (UI 非依存の純粋データ)。
// 複数のクラリネット指導者の解説記事から、アンブシュア・呼吸の正しい形と
// 崩れ・疲労のサインを抽出したもの。下唇の扱いは「半分引っ掛ける」派と
// 「巻いて歯にかぶせる」派で流儀が分かれるため、両者に共通する原則
// 「巻き込みすぎない」で表現を統一している (特定流儀を強制しない)。

export type ChecklistItem = { id: string; label: string; hint: string };
export type ChecklistSection = { id: string; title: string; items: ChecklistItem[] };

export const EMBOUCHURE_SECTIONS: ChecklistSection[] = [
  {
    id: 'embouchure',
    title: 'アンブシュア',
    items: [
      {
        id: 'emb-lower-lip',
        label: '下唇を巻き込みすぎていない',
        hint: '赤い柔らかい部分が軽くリードに触れる程度。巻き込みすぎると音がこもる',
      },
      {
        id: 'emb-lower-center',
        label: '下唇の中央が前歯の頂点に来ている',
        hint: '中央からずれると片当たりして疲れやすい',
      },
      {
        id: 'emb-upper-lip',
        label: '上唇もマウスピースに当てて支えている',
        hint: '上唇でも支えると、下唇と噛む力に頼りすぎない',
      },
      {
        id: 'emb-chin-down',
        label: '顎を下に張っている（丸めない）',
        hint: '下唇から顎下に「くぼみ」ができるのが目安。梅干し状のしわが寄るのは崩れのサイン',
      },
      {
        id: 'emb-corners',
        label: '口角に力を入れず、横に引いていない',
        hint: '横に引くより「笑うように頬を上げる」意識で',
      },
      {
        id: 'emb-cheeks',
        label: '頬を膨らませていない',
        hint: '頬が膨らむと息の圧が逃げてコントロールが落ちる',
      },
      {
        id: 'emb-bite',
        label: '歯で挟むだけで噛みしめていない',
        hint: 'リードの振動を止めない。口周りの筋肉で包む感覚で',
      },
      {
        id: 'emb-jaw-forward',
        label: '下あごをほんの少し前に出す程度',
        hint: '出しすぎず、あくまで挟むだけ',
      },
      {
        id: 'emb-depth',
        label: 'マウスピースをくわえる深さが適切',
        hint: '浅すぎると小さい音、深すぎると開いた音になりやすい',
      },
      {
        id: 'emb-stable',
        label: '音域・強弱・アーティキュレーションが変わっても形が動かない',
        hint: '高音/低音・ff/pp・レガート/スタッカートでも一定に',
      },
      {
        id: 'emb-tonguing',
        label: 'タンギング中も口がモグモグ動かない',
        hint: '舌だけを動かし、アンブシュアは固定する',
      },
    ],
  },
  {
    id: 'breathing',
    title: '呼吸',
    items: [
      {
        id: 'br-fill-bottom',
        label: '肺の底から吸う（満杯にしない・80〜90%）',
        hint: 'コップに水を溜めるように。満杯まで吸うと力んで支えが効かない',
      },
      {
        id: 'br-relax',
        label: 'お腹・腹筋に力を入れず、脱力して吸う',
        hint: '力むより脱力。結果として腹式になっているのが理想',
      },
      {
        id: 'br-tanden',
        label: '丹田（おへその下）から息を送り出す意識',
        hint: '丹田→気管→喉→口→楽器の道筋をイメージする',
      },
      {
        id: 'br-air',
        label: '「細く・速く・遠くに」ろうそくを消すような息',
        hint: '冷たい息を遠くへ飛ばすつもりで',
      },
      {
        id: 'br-column',
        label: '息の柱が体の中心を通っている',
        hint: '体の軸に沿ってまっすぐ立ち上げる',
      },
    ],
  },
];

// 崩れ・疲れのサイン (チェック項目ではなく参考テキスト)。
// これらが出たら一度止めて、鏡や窓の映り込みで形を確認する。
export const EMBOUCHURE_WARNING_SIGNS: readonly string[] = [
  '口を横に引いている',
  '顎が丸くなる・梅干し状のしわが寄る',
  'マウスピースを噛みしめている',
  '頬が膨らむ',
  '息が唇の両端から漏れる',
  '唇が痛い・疲れてきた',
];

export const EMBOUCHURE_TIP =
  '疲れは筋力不足のことも。ロングトーンで段階的に鍛え、慣れたら余分な力を抜く。鏡や窓の映り込みで形を確認しよう。';
