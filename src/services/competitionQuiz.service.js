import { prisma } from "../lib/prisma.js";

// Generator data sets for different categories
const TOPIC_PRESETS = {
  html: {
    easy: [
      { q: "HTML qisqartmasi nimani anglatadi?", options: ["Hyper Text Markup Language", "High Text Making Language", "Hyperlinks and Text Markup Language", "Home Tool Markup Language"], a: "Hyper Text Markup Language" },
      { q: "HTML da eng katta sarlavha qaysi teg orqali yaratiladi?", options: ["<h1>", "<h6>", "<heading>", "<head>"], a: "<h1>" },
      { q: "Giperhavola (link) yaratish uchun qaysi teg ishlatiladi?", options: ["<a>", "<link>", "<href>", "<nav>"], a: "<a>" },
      { q: "Rasm qo'yish uchun to'g'ri HTML tegi qaysi?", options: ["<img>", "<image>", "<pic>", "<src>"], a: "<img>" },
      { q: "Qaysi teg matnni yangi qatorga tushirish (line break) uchun ishlatiladi?", options: ["<br>", "<lb>", "<break>", "<hr>"], a: "<br>" },
      { q: "Raqamlangan ro'yxat (ordered list) qaysi teg bilan yaratiladi?", options: ["<ol>", "<ul>", "<li>", "<dl>"], a: "<ol>" },
      { q: "Raqamlanmagan ro'yxat (bulleted list) qaysi teg bilan yaratiladi?", options: ["<ul>", "<ol>", "<li>", "<list>"], a: "<ul>" },
      { q: "HTML faylining asosiy ildiz (root) tegi nima?", options: ["<html>", "<head>", "<body>", "<!DOCTYPE>"], a: "<html>" },
      { q: "Foydalanuvchidan matn kiritishni so'rash uchun qaysi teg ishlatiladi?", options: ["<input>", "<text>", "<textfield>", "<form>"], a: "<input>" },
      { q: "Qaysi atribut havola bosilganda yangi oynada ochilishini ta'minlaydi?", options: ["target='_blank'", "target='_new'", "window='new'", "href='_blank'"], a: "target='_blank'" },
      { q: "Matnni qalin (bold) qilib ko'rsatish uchun semantik jihatdan to'g'ri teg qaysi?", options: ["<strong>", "<b>", "<bold>", "<heavy>"], a: "<strong>" },
      { q: "Matnni qiya (italic) qilib ko'rsatish uchun semantik teg qaysi?", options: ["<em>", "<i>", "<italic>", "<slanted>"], a: "<em>" },
      { q: "Jadval yaratish uchun asosiy HTML tegi qaysi?", options: ["<table>", "<grid>", "<tab>", "<tr>"], a: "<table>" },
      { q: "Jadval qatorini (table row) yaratish uchun qaysi teg ishlatiladi?", options: ["<tr>", "<td>", "<th>", "<row>"], a: "<tr>" },
      { q: "Jadval ma'lumot katakchasi (table data) qaysi teg bilan belgilanadi?", options: ["<td>", "<tr>", "<th>", "<cell>"], a: "<td>" },
      { q: "Rasm yuklanmay qolganda uning o'rnida chiqadigan matn qaysi atributda beriladi?", options: ["alt", "title", "caption", "description"], a: "alt" },
      { q: "HTML sahifaning brauzer sarlavhasida (tab) ko'rinadigan matn qaysi tegda yoziladi?", options: ["<title>", "<meta>", "<header>", "<h1>"], a: "<title>" },
      { q: "Gorizontal chiziq chizish uchun qaysi teg ishlatiladi?", options: ["<hr>", "<line>", "<border>", "<divider>"], a: "<hr>" },
      { q: "Forma ichidagi tugma (button) yaratish uchun qaysi teg to'g'ri?", options: ["<button>", "<press>", "<click>", "<submit>"], a: "<button>" },
      { q: "HTML5 standarti qachon rasman tavsiya etilgan?", options: ["2014-yil", "2008-yil", "2010-yil", "2018-yil"], a: "2014-yil" }
    ],
    medium: [
      { q: "HTML5 da semantik teglardan biri bo'lgan mustaqil maqolani belgilash tegi qaysi?", options: ["<article>", "<section>", "<aside>", "<main>"], a: "<article>" },
      { q: "Saytning asosiy navigatsiya havolalari guruhini qaysi semantik teg ichiga olish lozim?", options: ["<nav>", "<menu>", "<links>", "<header>"], a: "<nav>" },
      { q: "Yon panel (sidebar) yoki qo'shimcha ma'lumotlar uchun qaysi teg mo'ljallangan?", options: ["<aside>", "<sidebar>", "<section>", "<extra>"], a: "<aside>" },
      { q: "HTML5 audio fayllarni ijro etish uchun qaysi standart teg qo'llaniladi?", options: ["<audio>", "<sound>", "<media>", "<music>"], a: "<audio>" },
      { q: "Canvas elementi HTML da nima maqsadda ishlatiladi?", options: ["JavaScript orqali 2D/3D grafika va animatsiya chizish uchun", "Vektorli shriftlarni yuklash uchun", "Rasm formatini o'zgartirish uchun", "Audio vizualizatsiyasi uchun"], a: "JavaScript orqali 2D/3D grafika va animatsiya chizish uchun" },
      { q: "Formadagi inputni majburiy to'ldirish talabini qaysi atribut bajaradi?", options: ["required", "validate", "must", "mandatory"], a: "required" },
      { q: "<input type='email'> ning oddiy 'text' turidan afzalligi nimada?", options: ["Brauzer avtomatik email sintaksisini tekshiradi va mobil klaviaturada @ chiqaradi", "Emailga avtomatik tasdiqlash kodi yuboradi", "Parolni shifrlaydi", "Faqat gmail qabul qiladi"], a: "Brauzer avtomatik email sintaksisini tekshiradi va mobil klaviaturada @ chiqaradi" },
      { q: "HTML da maxsus belgilar (HTML entities) qaysi belgi bilan boshlanadi?", options: ["&", "#", "%", "$"], a: "&" },
      { q: "Bo'sh joy (non-breaking space) maxsus belgisi qanday yoziladi?", options: ["&nbsp;", "&space;", "&blank;", "&empty;"], a: "&nbsp;" },
      { q: "<meta charset='UTF-8'> tegi nima vazifani bajaradi?", options: ["Hujjatdagi matn belgilarining kodlash standartini (Unicode) belgilaydi", "Saytni 8 ta tilga tarjima qiladi", "Sahifa yuklanish tezligini oshiradi", "Xavfsizlik sertifikatini faollashtiradi"], a: "Hujjatdagi matn belgilarining kodlash standartini (Unicode) belgilaydi" },
      { q: "SVG va Canvas o'rtasidagi asosiy farq nima?", options: ["SVG vektorli (DOM mavjud), Canvas piksel asosli (raster)", "SVG faqat 3D, Canvas faqat 2D", "Canvas SVG dan sekinroq ishlaydi", "Hech qanday farq yo'q"], a: "SVG vektorli (DOM mavjud), Canvas piksel asosli (raster)" },
      { q: "<picture> elementi HTML da asosan nima uchun ishlatiladi?", options: ["Responsive dizaynda turli ekran o'lchamlari uchun turli rasmlarni taqdim etish", "Rasmlarni tahrirlash uchun", "Video galereya yaratish uchun", "SVG rasmlarni siqish uchun"], a: "Responsive dizaynda turli ekran o'lchamlari uchun turli rasmlarni taqdim etish" },
      { q: "Ochiluvchi/yopiluvchi interaktiv accordion yaratish uchun qaysi teglar juftligi ishlatiladi?", options: ["<details> va <summary>", "<accordion> va <tab>", "<toggle> va <content>", "<dropdown> va <item>"], a: "<details> va <summary>" },
      { q: "<progress> va <meter> teglari o'rtasidagi farq nima?", options: ["progress jarayon borishini, meter esa ma'lum oraliqdagi statik o'lchovni ifodalaydi", "progress faqat foizda ishlaydi", "meter faqat haroratni ko'rsatadi", "Ikkalasi aynan bir xil"], a: "progress jarayon borishini, meter esa ma'lum oraliqdagi statik o'lchovni ifodalaydi" },
      { q: "Autofocus atributi nima qiladi?", options: ["Sahifa ochilganda kursor avtomatik ushbu input maydoniga o'tadi", "Rasmni fokusga oladi", "Matnni kattalashtiradi", "Formani avtomatik submit qiladi"], a: "Sahifa ochilganda kursor avtomatik ushbu input maydoniga o'tadi" }
    ],
    hard: [
      { q: "HTML da aria-* atributlari (WAI-ARIA) nima uchun zarur?", options: ["Imkoniyati cheklangan foydalanuvchilar va screen readerlar uchun foydalanish qulayligini (Accessibility) oshirish", "CSS animatsiyalarini tezlashtirish", "SEO reytingini aldash", "JavaScript xatolarini ushlash"], a: "Imkoniyati cheklangan foydalanuvchilar va screen readerlar uchun foydalanish qulayligini (Accessibility) oshirish" },
      { q: "<script async> va <script defer> o'rtasidagi tub farq nima?", options: ["defer HTML to'liq parse bo'lgandan so'ng navbat bilan ishlaydi, async esa yuklanishi bilanoq DOM parseni to'xtatib ishga tushadi", "async faqat tashqi fayllar bilan ishlaydi", "defer skriptni fonda o'chiradi", "Ikkalasi bir xil ishlaydi"], a: "defer HTML to'liq parse bo'lgandan so'ng navbat bilan ishlaydi, async esa yuklanishi bilanoq DOM parseni to'xtatib ishga tushadi" },
      { q: "Shadow DOM nima va u qaysi texnologiyaning asosi hisoblanadi?", options: ["Web Components uchun izolyatsiyalangan DOM daraxti va CSS uslublarini yaratish mexanizmi", "Brauzerning qorong'i rejimi", "Yashirin reklamalar ko'rsatish", "Virtual DOM ning yangi versiyasi"], a: "Web Components uchun izolyatsiyalangan DOM daraxti va CSS uslublarini yaratish mexanizmi" },
      { q: "Content-Security-Policy (CSP) meta tegi nima maqsadda ishlatiladi?", options: ["XSS (Cross-Site Scripting) va ma'lumot o'g'irlanishining oldini olish uchun ruxsat etilgan resurs manbalarini cheklash", "Saytni HTTPS ga majburlash", "Cookie fayllarni bloklash", "Sahifani tez yuklash"], a: "XSS (Cross-Site Scripting) va ma'lumot o'g'irlanishining oldini olish uchun ruxsat etilgan resurs manbalarini cheklash" },
      { q: "<link rel='preload'> bilan <link rel='prefetch'> farqi nima?", options: ["preload joriy sahifa uchun muhim resursni darhol yuklaydi, prefetch esa kelgusi sahifalar uchun bo'sh vaqtda keshlaydi", "preload faqat shriflar uchun", "prefetch sahifani qayta yuklaydi", "Farqi yo'q"], a: "preload joriy sahifa uchun muhim resursni darhol yuklaydi, prefetch esa kelgusi sahifalar uchun bo'sh vaqtda keshlaydi" },
      { q: "Web Worker lar HTML sahifasida nima imkoniyat beradi?", options: ["JavaScript kodini asosiy UI thread'ini muzlatmasdan fon oqimida (background thread) bajarish", "Server bilan to'g'ridan-to'g'ri bog'lanish", "Fayllarni diskka yozish", "DOM elementlarini tezroq chizish"], a: "JavaScript kodini asosiy UI thread'ini muzlatmasdan fon oqimida (background thread) bajarish" },
      { q: "Microdata (schema.org) atributlari (itemscope, itemtype, itemprop) nima uchun kerak?", options: ["Qidiruv tizimlari (Google, Yandex) uchun sahifa kontentini chuqur semantik tuzilish bilan tushuntirish (Rich Snippets)", "CSS flexbox o'rniga", "Formani serverga yuborish", "Rasmlarni siqish"], a: "Qidiruv tizimlari (Google, Yandex) uchun sahifa kontentini chuqur semantik tuzilish bilan tushuntirish (Rich Snippets)" },
      { q: "<dialog> HTML5 elementining 'showModal()' va 'show()' metodlari farqi nima?", options: ["showModal() fonni xira qilib modal (backdrop bilan) ochadi, show() esa oddiy ochiq dialog qiladi", "showModal() faqat mobil ekranda ochiladi", "show() dialog yopadi", "Hech qanday farq yo'q"], a: "showModal() fonni xira qilib modal (backdrop bilan) ochadi, show() esa oddiy ochiq dialog qiladi" },
      { q: "Custom Elements (Shaxsiy HTML teglar) nomida qanday qat'iy qoida mavjud?", options: ["Teg nomida albatta kamida bitta defis (-) bo'lishi shart (masalan, <user-card>)", "Kamida 10 ta harf bo'lishi kerak", "Faqat bosh harflar bilan yoziladi", "Bunday qoida yo'q"], a: "Teg nomida albatta kamida bitta defis (-) bo'lishi shart (masalan, <user-card>)" },
      { q: "Intersection Observer API HTML da qaysi holatda eng ko'p qo'llaniladi?", options: ["Rasmlar va kontentlarni Lazy Loading (ko'rinish maydoniga kirganda yuklash) va cheksiz scroll uchun", "Server bilan websocket ochish", "Xavfsizlik tekshiruvi", "Shakllarni validatsiya qilish"], a: "Rasmlar va kontentlarni Lazy Loading (ko'rinish maydoniga kirganda yuklash) va cheksiz scroll uchun" }
    ],
    extreme: [
      {
        q: "HTML & JS Masala #1: Berilgan HTML matnidan barcha teg nomlarini takrorlanmas (unique) massiv sifatida qaytaruvchi 'extractTags(html)' funksiyasini yozing.",
        language: "javascript",
        template: "function extractTags(html) {\n  // Yechimingizni yozing\n  // Masalan: '<p>Salom <b>dunyo</b></p>' -> ['p', 'b']\n  \n}",
        expected: "p,b"
      },
      {
        q: "HTML & JS Masala #2: Berilgan ob'ektlar massividan to'g'ri HTML jadvali (<table>...</table>) qatorlarini <tr><td> formatida generatsiya qiluvchi 'generateTableRows(data)' funksiyasini yozing.",
        language: "javascript",
        template: "function generateTableRows(data) {\n  // data = [{name: 'Ali', score: 90}, {name: 'Vali', score: 85}]\n  // Natija: '<tr><td>Ali</td><td>90</td></tr><tr><td>Vali</td><td>85</td></tr>'\n  \n}",
        expected: "<tr><td>Ali</td><td>90</td></tr><tr><td>Vali</td><td>85</td></tr>"
      },
      {
        q: "HTML & JS Masala #3: HTML maxsus belgilari (&, <, >, \", ') ni xavfsiz entity shakliga o'tkazuvchi (XSS sanitization) 'escapeHtml(str)' funksiyasini yozing.",
        language: "javascript",
        template: "function escapeHtml(str) {\n  // '&' -> '&amp;', '<' -> '&lt;', '>' -> '&gt;', '\"' -> '&quot;', \"'\" -> '&#039;'\n  \n}",
        expected: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
      },
      {
        q: "HTML & JS Masala #4: Berilgan URL ro'yxatidan faqat xavfsiz (https:// bilan boshlanuvchi) havolalar uchun <a href='...'>Havola</a> teglarini hosil qiluvchi 'buildSecureLinks(urls)' funksiyasini yozing.",
        language: "javascript",
        template: "function buildSecureLinks(urls) {\n  // urls = ['https://google.com', 'http://unsafe.com', 'https://devrank.uz']\n  // Natija faqat https havolalari uchun <a> teglar qatori\n  \n}",
        expected: "<a href='https://google.com'>Link</a><a href='https://devrank.uz'>Link</a>"
      },
      {
        q: "HTML & JS Masala #5: Berilgan ierarxik menyu ob'ektidan nested (ichma-ich) <ul><li> HTML ro'yxatini hosil qiluvchi 'renderMenu(items)' rekursiv funksiyasini yozing.",
        language: "javascript",
        template: "function renderMenu(items) {\n  // items = [{title: 'Home'}, {title: 'About', children: [{title: 'Team'}]}]\n  // Yechimingizni yozing\n  \n}",
        expected: "<ul><li>Home</li><li>About<ul><li>Team</li></ul></li></ul>"
      }
    ]
  },
  web: {
    easy: [
      { q: "JavaScript da o'zgarmas o'zgaruvchi e'lon qilish uchun qaysi kalit so'z ishlatiladi?", options: ["const", "let", "var", "static"], a: "const" },
      { q: "CSS qisqartmasi nimani anglatadi?", options: ["Cascading Style Sheets", "Creative Style System", "Computer Style Sheets", "Colorful Style Sheets"], a: "Cascading Style Sheets" },
      { q: "DOM qisqartmasi nimani bildiradi?", options: ["Document Object Model", "Data Object Mode", "Digital Ordinance Model", "Desktop Oriented Mode"], a: "Document Object Model" },
      { q: "Brauzer konsoliga xabar chiqarish uchun qaysi buyruq yoziladi?", options: ["console.log()", "print()", "echo()", "system.out()"], a: "console.log()" },
      { q: "CSS da elementni markazga joylashtirish uchun display: flex bilan birga qaysi qoida ishlatiladi?", options: ["justify-content: center; align-items: center;", "text-align: middle;", "float: center;", "align: center;"], a: "justify-content: center; align-items: center;" },
      { q: "JavaScript da massiv uzunligini aniqlovchi xususiyat qaysi?", options: [".length", ".size", ".count", ".total"], a: ".length" },
      { q: "HTTP 200 kodi nimani anglatadi?", options: ["Muvaffaqiyatli so'rov (OK)", "Sahifa topilmadi (Not Found)", "Server xatosi (Internal Error)", "Ruxsat yo'q (Forbidden)"], a: "Muvaffaqiyatli so'rov (OK)" },
      { q: "HTTP 404 kodi nima?", options: ["Resurs topilmadi (Not Found)", "Server xatosi", "Muvaffaqiyatli", "Avtorizatsiya talab etiladi"], a: "Resurs topilmadi (Not Found)" },
      { q: "JSON qisqartmasi nimani anglatadi?", options: ["JavaScript Object Notation", "Java System Online Network", "JavaScript Output Node", "Joint Standard Open Network"], a: "JavaScript Object Notation" },
      { q: "JavaScript da qaysi operator qiymat va tur (type) ni bir vaqtda qat'iy tekshiradi?", options: ["===", "==", "=", "!="], a: "===" },
      { q: "CSS da shrift o'lchamini belgilovchi xususiyat qaysi?", options: ["font-size", "text-size", "font-style", "size"], a: "font-size" },
      { q: "Massiv oxiriga element qo'shish uchun qaysi metod ishlatiladi?", options: [".push()", ".pop()", ".shift()", ".unshift()"], a: ".push()" },
      { q: "Massiv oxiridan element o'chirish qaysi metod bilan bajariladi?", options: [".pop()", ".push()", ".slice()", ".cut()"], a: ".pop()" },
      { q: "CSS da tashqi masofa (margin) va ichki masofa (padding) o'rtasidagi farq nima?", options: ["margin element chegarasidan tashqarida, padding chegara ichida joylashadi", "margin faqat matn uchun", "padding chegaradan tashqarida", "Ikkalasi bir xil"], a: "margin element chegarasidan tashqarida, padding chegara ichida joylashadi" },
      { q: "JavaScript da funksiya yaratish uchun qaysi kalit so'z ishlatiladi?", options: ["function", "def", "fn", "method"], a: "function" },
      { q: "HTML da JavaScript faylini ulash uchun qaysi teg ishlatiladi?", options: ["<script src='...'>", "<js href='...'>", "<link rel='js'>", "<code src='...'>"], a: "<script src='...'>" },
      { q: "HTML da CSS faylini ulash uchun qaysi teg ishlatiladi?", options: ["<link rel='stylesheet' href='...'>", "<style src='...'>", "<css href='...'>", "<script rel='css'>"], a: "<link rel='stylesheet' href='...'>" },
      { q: "JavaScript da typeof null nima qaytaradi?", options: ["'object'", "'null'", "'undefined'", "'boolean'"], a: "'object'" },
      { q: "CSS da elementni butunlay yashirish va joyini bo'shatish qaysi qoida bilan qilinadi?", options: ["display: none;", "visibility: hidden;", "opacity: 0;", "filter: hide;"], a: "display: none;" },
      { q: "Foydalanuvchi klaviaturada tugma bosganini qaysi event ushlaydi?", options: ["keydown / keyup", "click", "hover", "press"], a: "keydown / keyup" }
    ],
    medium: [
      { q: "JavaScript da Event Loop (hodisalar tsikli) ning asosiy vazifasi nima?", options: ["Call Stack bo'shaganda Task Queue va Microtask Queue dagi callbacklarni chaqirish", "Xotirani tozalash (garbage collection)", "HTML ni qayta chizish", "Tarmoq ulanishini nazorat qilish"], a: "Call Stack bo'shaganda Task Queue va Microtask Queue dagi callbacklarni chaqirish" },
      { q: "Promise.all() va Promise.allSettled() farqi nima?", options: ["Promise.all bitta reject bo'lsa darhol xato qaytaradi, allSettled esa barchasining natijasini kutadi", "Promise.all sekinroq ishlaydi", "allSettled faqat muvaffaqiyatlilarni qaytaradi", "Farqi yo'q"], a: "Promise.all bitta reject bo'lsa darhol xato qaytaradi, allSettled esa barchasining natijasini kutadi" },
      { q: "CSS Box Model tarkibiy qismlari tartibi to'g'ri ko'rsatilgan qator qaysi?", options: ["content -> padding -> border -> margin", "margin -> border -> content -> padding", "content -> margin -> border -> padding", "border -> padding -> margin -> content"], a: "content -> padding -> border -> margin" },
      { q: "box-sizing: border-box nima vazifani bajaradi?", options: ["Padding va border o'lchamlarini elementning umumiy kengligi (width) ichiga kiritadi", "Faqat borderni qalinlashtiradi", "Marginni hisobga oladi", "Elementni qutiga soladi"], a: "Padding va border o'lchamlarini elementning umumiy kengligi (width) ichiga kiritadi" },
      { q: "JavaScript da closure (yopiq muhit) nima?", options: ["Ichki funksiyaning o'zi yaratilgan tashqi muhit (lexical scope) o'zgaruvchilariga kirish huquqini saqlab qolishi", "Funksiyani private qilish kaliti", "Rekursiv chaqiriq turi", "Xatolikni yopish usuli"], a: "Ichki funksiyaning o'zi yaratilgan tashqi muhit (lexical scope) o'zgaruvchilariga kirish huquqini saqlab qolishi" },
      { q: "LocalStorage va SessionStorage ning asosiy farqi nima?", options: ["LocalStorage brauzer yopilganda ham saqlanadi, SessionStorage esa tab yopilganda o'chadi", "LocalStorage faqat 1KB ma'lumot saqlaydi", "SessionStorage serverga yuboriladi", "Farqi yo'q"], a: "LocalStorage brauzer yopilganda ham saqlanadi, SessionStorage esa tab yopilganda o'chadi" },
      { q: "REST API da ma'lumotni to'liq yangilash uchun PUT, qisman yangilash uchun qaysi metod ishlatiladi?", options: ["PATCH", "POST", "UPDATE", "MODIFY"], a: "PATCH" },
      { q: "CORS (Cross-Origin Resource Sharing) xatosi nima sababdan yuz beradi?", options: ["Brauzer xavfsizlik siyosati tufayli boshqa domen/portdan kelgan so'rovni server ruxsatisiz bloklaganda", "Internet uzilganda", "DB xatosi sababli", "Faqat HTTPS ishlamaganda"], a: "Brauzer xavfsizlik siyosati tufayli boshqa domen/portdan kelgan so'rovni server ruxsatisiz bloklaganda" },
      { q: "CSS Grid va Flexbox ning asosiy farqi nimada?", options: ["Flexbox bir o'lchamli (1D: qator yoki ustun), Grid ikki o'lchamli (2D: qator va ustun) layout uchun", "Flexbox faqat matnlar uchun", "Grid eskiroq texnologiya", "Farqi yo'q"], a: "Flexbox bir o'lchamli (1D: qator yoki ustun), Grid ikki o'lchamli (2D: qator va ustun) layout uchun" },
      { q: "JavaScript da immutability (o'zgarmaslik) tamoyili nima uchun muhim?", options: ["Kutilmagan yon ta'sirlarning (side effects) oldini oladi va holatni (state) boshqarishni osonlashtiradi", "Xotirani tejaydi", "Kod hajmini qisqartiradi", "Bunday tamoyil yo'q"], a: "Kutilmagan yon ta'sirlarning (side effects) oldini oladi va holatni (state) boshqarishni osonlashtiradi" },
      { q: "Debounce va Throttle texnikalari nima uchun qo'llaniladi?", options: ["Tez-tez chaqiriladigan hodisalarni (scroll, resize, search input) optimallashtirib, funksiya bajarilish sonini cheklash", "Xotira tozalash uchun", "CSS animatsiyasini tezlashtirish", "DB indekslash"], a: "Tez-tez chaqiriladigan hodisalarni (scroll, resize, search input) optimallashtirib, funksiya bajarilish sonini cheklash" },
      { q: "Array.prototype.reduce() metodi nima qaytaradi?", options: ["Barcha elementlarni qayta ishlab, yagona jamlangan qiymat (son, ob'ekt, massiv)", "Faqat sonlar yig'indisini", "Yangi filtrланган massiv", "Boolean qiymat"], a: "Barcha elementlarni qayta ishlab, yagona jamlangan qiymat (son, ob'ekt, massiv)" },
      { q: "JWT (JSON Web Token) tarkibi necha qismdan iborat?", options: ["3 qism: Header, Payload, Signature (nuqta bilan ajratilgan)", "2 qism: Key va Value", "4 qism: Head, Body, Hash, Salt", "1 qism: Base64 satr"], a: "3 qism: Header, Payload, Signature (nuqta bilan ajratilgan)" },
      { q: "XSS (Cross-Site Scripting) hujumi qanday amalga oshiriladi?", options: ["Foydalanuvchi kiritgan ma'lumot orqali sahifaga zararli JavaScript skripti joylab yuborish", "Server parolini bruteforce qilish", "Tarmoq paketlarini ushlash", "SQL so'rovini buzish"], a: "Foydalanuvchi kiritgan ma'lumot orqali sahifaga zararli JavaScript skripti joylab yuborish" },
      { q: "Cookie fayllarida 'HttpOnly' flagi nima vazifani bajaradi?", options: ["JavaScript (document.cookie) orqali ushbu cookie'ga kirishni bloklab, XSS orqali sessiya o'g'irlanishining oldini oladi", "Faqat HTTP da ishlashni belgilaydi", "Cookie muddatini cheksiz qiladi", "Cookie'ni shifrlaydi"], a: "JavaScript (document.cookie) orqali ushbu cookie'ga kirishni bloklab, XSS orqali sessiya o'g'irlanishining oldini oladi" }
    ],
    hard: [
      { q: "JavaScript da Microtask va Macrotask navbatlari o'rtasidagi farq nima?", options: ["Microtask (Promise, queueMicrotask) joriy sikl oxirida Macrotask (setTimeout, setInterval) dan oldin bajariladi", "Macrotask tezroq ishlaydi", "Ikkalasi bitta navbatda turadi", "Microtask faqat Node.js da bor"], a: "Microtask (Promise, queueMicrotask) joriy sikl oxirida Macrotask (setTimeout, setInterval) dan oldin bajariladi" },
      { q: "V8 dvigatelida Garbage Collection ning Mark-and-Sweep algoritmi qanday ishlaydi?", options: ["Ildiz (root) ob'ektlardan boshlab yetib boriladigan ob'ektlarni belgilaydi, yetib borib bo'lmaydiganlarini o'chiradi", "Faqat eng qadimgi ob'ektlarni o'chiradi", "Har 5 soniyada barcha xotirani tozalaydi", "Katta ob'ektlarni diskka yozadi"], a: "Ildiz (root) ob'ektlardan boshlab yetib boriladigan ob'ektlarni belgilaydi, yetib borib bo'lmaydiganlarini o'chiradi" },
      { q: "WebSockets va Server-Sent Events (SSE) o'rtasidagi asosiy farq nima?", options: ["WebSocket ikki tomonlama (full-duplex), SSE esa faqat serverdan mijozga bir tomonlama oqim (HTTP orqali)", "SSE tezroq ishlaydi", "WebSocket faqat matn yubora oladi", "Farqi yo'q"], a: "WebSocket ikki tomonlama (full-duplex), SSE esa faqat serverdan mijozga bir tomonlama oqim (HTTP orqali)" },
      { q: "React da Virtual DOM ning Diffing algoritmining murakkabligi O(n^3) dan qanday qilib O(n) ga tushirilgan?", options: ["Turli turdagi elementlar butunlay yangi daraxt hosil qilishi va 'key' atributi orqali bolalarni aniqlash evaziga", "Faqat so'nggi elementni tekshirish orqali", "C++ da yozilgani uchun", "Aslida O(n^2) da ishlaydi"], a: "Turli turdagi elementlar butunlay yangi daraxt hosil qilishi va 'key' atributi orqali bolalarni aniqlash evaziga" },
      { q: "Tree Shaking texnologiyasi zamonaviy brauzer bundlerlarida (Webpack, Vite) qanday ishlaydi?", options: ["ES6 import/export ning statik strukturasidan foydalanib, loyihada ishlatilmagan (dead) kodni yakuniy to'plamdan chiqarib tashlaydi", "Fayllarni gzip bilan siqadi", "Rasm hajmini kichraytiradi", "Funksiyalarni inline qiladi"], a: "ES6 import/export ning statik strukturasidan foydalanib, loyihada ishlatilmagan (dead) kodni yakuniy to'plamdan chiqarib tashlaydi" },
      { q: "SQL Injection hujumidan himoyalanishning eng ishonchli usuli qaysi?", options: ["Parametrlangan so'rovlar (Parameterized Queries / Prepared Statements) va ORM lardan foydalanish", "Maxsus belgilarni o'chirish", "Parolni uzun qilish", "Faqat GET so'rov ishlatish"], a: "Parametrlangan so'rovlar (Parameterized Queries / Prepared Statements) va ORM lardan foydalanish" },
      { q: "Service Worker lar PWA (Progressive Web Apps) da qanday asosiy rolni bajaradi?", options: ["Tarmoq so'rovlarini ushlab (proxy), oflayn rejimni, keshlashni va push bildirishnomalarni ta'minlaydi", "Sayt dizaynini moslashtiradi", "Server bazasini boshqaradi", "Dasturni o'rnatadi"], a: "Tarmoq so'rovlarini ushlab (proxy), oflayn rejimni, keshlashni va push bildirishnomalarni ta'minlaydi" },
      { q: "WebAssembly (WASM) ning asosiy maqsadi va afzalligi nima?", options: ["C/C++, Rust kabi tillarda yozilgan kodni brauzerda deyarli apparat tezligida (near-native speed) bajarish", "JavaScript ni butunlay yo'q qilish", "HTML o'rnini bosish", "Grafik dizayn yaratish"], a: "C/C++, Rust kabi tillarda yozilgan kodni brauzerda deyarli apparat tezligida (near-native speed) bajarish" },
      { q: "Optimistic UI Updates (Optimizm yangilanishlar) konsepsiyasi nima?", options: ["Server javobini kutmasdan, foydalanuvchi interfeysini darhol muvaffaqiyatli bo'lgandek yangilab, xato bo'lsa orqaga qaytarish (rollback)", "Saytga pozitiv ranglar berish", "Server xatolarini yashirish", "Barcha animatsiyalarni tezlashtirish"], a: "Server javobini kutmasdan, foydalanuvchi interfeysini darhol muvaffaqiyatli bo'lgandek yangilab, xato bo'lsa orqaga qaytarish (rollback)" },
      { q: "Serverless arxitekturada 'Cold Start' (sovuq start) muammosi nimani bildiradi?", options: ["Funksiya ancha vaqt chaqirilmagandan so'ng birinchi so'rov kelganda konteyner yuklanishi tufayli kechikish (latency) yuzaga kelishi", "Server muzlab qolishi", "Keshning eskirishi", "Oflayn rejim xatosi"], a: "Funksiya ancha vaqt chaqirilmagandan so'ng birinchi so'rov kelganda konteyner yuklanishi tufayli kechikish (latency) yuzaga kelishi" }
    ],
    extreme: [
      {
        q: "Web Masala #1: Berilgan massivdagi chuqur ichma-ich joylashgan elementlarni bitta tekis massivga keltiruvchi 'flattenArray(arr)' funksiyasini yozing (Array.flat ishlatmasdan).",
        language: "javascript",
        template: "function flattenArray(arr) {\n  // Masalan: [1, [2, [3, [4]], 5]] -> [1, 2, 3, 4, 5]\n  \n}",
        expected: "[1,2,3,4,5]"
      },
      {
        q: "Web Masala #2: Berilgan ob'ektni chuqur nusxalovchi (Deep Clone) 'deepClone(obj)' funksiyasini yozing (JSON.parse/stringify ishlatmasdan).",
        language: "javascript",
        template: "function deepClone(obj) {\n  // Ob'ekt va uning barcha ichki ob'ektlari nusxasini yarating\n  \n}",
        expected: "done"
      },
      {
        q: "Web Masala #3: Matnda har bir so'z necha marta qatnashganini hisoblab, ob'ekt ko'rinishida qaytaruvchi 'wordFrequency(text)' funksiyasini yozing.",
        language: "javascript",
        template: "function wordFrequency(text) {\n  // Masalan: 'salom dunyo salom' -> { salom: 2, dunyo: 1 }\n  \n}",
        expected: "salom:2,dunyo:1"
      },
      {
        q: "Web Masala #4: Ikki tartiblangan massivni bitta tartiblangan massivga birlashtiruvchi 'mergeSorted(arr1, arr2)' funksiyasini O(n+m) vaqtda ishlaydigan qilib yozing.",
        language: "javascript",
        template: "function mergeSorted(arr1, arr2) {\n  // arr1 = [1, 3, 5], arr2 = [2, 4, 6] -> [1, 2, 3, 4, 5, 6]\n  \n}",
        expected: "[1,2,3,4,5,6]"
      },
      {
        q: "Web Masala #5: Berilgan qavslar qatori (masalan: '({[]})') to'g'ri yopilganligini tekshiruvchi 'isValidParentheses(s)' funksiyasini stack yordamida yozing.",
        language: "javascript",
        template: "function isValidParentheses(s) {\n  // '()' -> true, '()[]{}' -> true, '(]' -> false, '([)]' -> false\n  \n}",
        expected: "true"
      }
    ]
  }
};

// Generic generator for any topic
function getTopicData(category, title = "") {
  const c = (category || "").toLowerCase();
  const t = (title || "").toLowerCase();
  if (t.includes("html") || c.includes("html")) return TOPIC_PRESETS.html;
  return TOPIC_PRESETS.web;
}

export async function generateCompetitionQuestions(competitionId) {
  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { questions: true }
  });

  if (!comp) throw new Error("Musobaqa topilmadi.");

  // If questions already exist, return them
  if (comp.questions && comp.questions.length >= 50) {
    return comp.questions;
  }

  // Delete existing if partial
  if (comp.questions && comp.questions.length > 0) {
    await prisma.competitionQuestion.deleteMany({ where: { competitionId } });
  }

  const preset = getTopicData(comp.category, comp.title);
  const questionsToCreate = [];

  // 1-20: Easy (QUIZ)
  for (let i = 0; i < 20; i++) {
    const item = preset.easy[i % preset.easy.length];
    questionsToCreate.push({
      competitionId,
      orderIndex: i + 1,
      difficulty: "easy",
      type: "QUIZ",
      question: item.q,
      options: JSON.stringify(item.options),
      correctAnswer: item.a,
      points: 30
    });
  }

  // 21-35: Medium (QUIZ)
  for (let i = 0; i < 15; i++) {
    const item = preset.medium[i % preset.medium.length];
    questionsToCreate.push({
      competitionId,
      orderIndex: 20 + i + 1,
      difficulty: "medium",
      type: "QUIZ",
      question: item.q,
      options: JSON.stringify(item.options),
      correctAnswer: item.a,
      points: 50
    });
  }

  // 36-45: Hard (QUIZ)
  for (let i = 0; i < 10; i++) {
    const item = preset.hard[i % preset.hard.length];
    questionsToCreate.push({
      competitionId,
      orderIndex: 35 + i + 1,
      difficulty: "hard",
      type: "QUIZ",
      question: item.q,
      options: JSON.stringify(item.options),
      correctAnswer: item.a,
      points: 80
    });
  }

  // 46-50: Extreme (CODE)
  for (let i = 0; i < 5; i++) {
    const item = preset.extreme[i % preset.extreme.length];
    questionsToCreate.push({
      competitionId,
      orderIndex: 45 + i + 1,
      difficulty: "extreme",
      type: "CODE",
      question: item.q,
      options: null,
      correctAnswer: item.expected,
      codeTemplate: item.template,
      language: item.language || "javascript",
      points: 150
    });
  }

  // Insert in bulk
  for (const q of questionsToCreate) {
    await prisma.competitionQuestion.create({ data: q });
  }

  return await prisma.competitionQuestion.findMany({
    where: { competitionId },
    orderBy: { orderIndex: "asc" }
  });
}
