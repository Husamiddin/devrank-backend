import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const quiz=(question,options,correctIndex)=>({question,options,correctIndex});
const code=(title,category,language,difficulty,description,starterCode,inputExample,outputExample,points,checks)=>({title,category,type:"CODE",language,difficulty,description,starterCode,inputExample,outputExample,points,tests:{checks}});
const q=(title,category,difficulty,question,options,correctIndex,points=75)=>({title,category,type:"QUIZ",language:"quiz",difficulty,description:"Savolga to‘g‘ri javobni tanlang. Natija profilingizga yoziladi.",starterCode:"",points,quiz:quiz(question,options,correctIndex),tests:{checks:[]}});
const challenges=[
code("Two Sum","web","javascript","easy","Massivdan target yig‘indisini beradigan indekslarni toping.",`function twoSum(nums, target) {\n  // yozing\n  return [];\n}`,"nums=[2,7,11,15], target=9","[0,1]",100,[{name:"Map ishlatilishi",type:"containsAny",values:["new Map()","new Map"]},{name:"seen storage",type:"containsAny",values:["seen.set","seen.has"]},{name:"target bilan ishlash",type:"containsAny",values:["target -","target-"]}]),
code("TypeScript API type guard","web","typescript","easy","unknown qiymatni xavfsiz User tipiga tekshiring.",`type User={id:string;name:string};\nfunction isUser(value: unknown): value is User {\n  return false;\n}`,"unknown object","true",100,[{name:"type predicate",type:"containsAll",values:["value is User"]},{name:"unknown",type:"containsAll",values:["unknown"]},{name:"id/name check",type:"containsAny",values:["id","name"]}]),
code("C# minimal validator","web","csharp","medium","Email string bo‘sh emasligini va @ belgisi borligini tekshiradigan validator yozing.",`public static bool IsValidEmail(string email) {\n    return false;\n}`,"user@example.com","true",110,[{name:"bool return",type:"containsAll",values:["bool","return"]},{name:"@ check",type:"containsAny",values:["Contains(\"@\")","Contains('@')","@"]},{name:"empty check",type:"containsAny",values:["IsNullOrWhiteSpace","Length"]}]),
q("HTTP status 201 nimani bildiradi?","web","easy","HTTP POST muvaffaqiyatli bajarilib yangi resurs yaratilganda odatda qaysi status qaytadi?",["200","201","204","404"],1),
q("SQL injection himoyasi","web","medium","SQL querylarda user inputni xavfsiz uzatishning to‘g‘ri yondashuvi qaysi?",["String concatenation","Parameterized query","eval()","HTML encode"],1),
q("Async JavaScript","web","medium","Promise natijasini kutish uchun qaysi kalit so‘z ishlatiladi?",["yield","await","defer","pause"],1),
q("REST resource","web","easy","Yangi user yaratish uchun REST'da qaysi HTTP method odatda ishlatiladi?",["GET","POST","DELETE","HEAD"],1),
q("Web accessibility","web","easy","Rasm uchun ma'noli alternative matn berishning asosiy atributi qaysi?",["src","alt","role-only","title"],1),

code("Python feature vector","ai","python","easy","Ikki sonni tuple sifatida qaytaring va tip annotatsiyasidan foydalaning.",`def pair(a: float, b: float):\n    return ()\n`,`a=1.5, b=2.5`,"(1.5, 2.5)",100,[{name:"Python function",type:"containsAll",values:["def pair"]},{name:"type annotation",type:"containsAll",values:[": float"]},{name:"tuple return",type:"containsAny",values:["return (a, b)","return (a,b)"]}]),
code("Python text cleaning","ai","python","medium","Textni lowercase qilib, ortiqcha bo‘shliqlarni tozalang.",`def clean(text: str) -> str:\n    return text\n`,`"  Hello   AI  "`,`"hello ai"`,110,[{name:"lower",type:"containsAny",values:["lower()","casefold()"]},{name:"strip",type:"containsAny",values:["strip()"]},{name:"whitespace",type:"containsAny",values:["split()","' '.join"]}]),
code("C++ vector average","ai","cpp","medium","vector ichidagi sonlarning o‘rtachasini hisoblang.",`double average(const std::vector<int>& values) {\n    return 0;\n}`,"[2,4,6]","4",120,[{name:"vector",type:"containsAll",values:["vector<int>"]},{name:"accumulation",type:"containsAny",values:["sum","accumulate"]},{name:"division",type:"containsAny",values:["values.size()","/ values.size"]}]),
q("Overfitting","ai","easy","Model training datasetda juda yaxshi, yangi data'da esa yomon ishlasa bu nima deyiladi?",["Underfitting","Overfitting","Normalization","Embedding"],1),
q("Train/test split","ai","easy","Test datasetning asosiy vazifasi nima?",["Modelni train qilish","Generalizationni baholash","Data yaratish","GPU qizdirish"],1),
q("Embedding","ai","medium","Embedding asosan nimani ifodalaydi?",["Matn yoki obyektni vektor fazoda sonli ko‘rinishda","Database password","CPU instruction","CSS class"],0),
q("Transformer","ai","medium","Transformer architecture'ning muhim mexanizmi qaysi?",["Self-attention","CSS grid","B-tree only","FTP"],0),
q("Prompt injection","ai","hard","AI tizimiga zararli ko‘rsatmalarni prompt orqali kiritish nima deyiladi?",["Prompt injection","Overclocking","Normalization","Sharding"],0),

code("Password hash policy","cyber","python","easy","Parolni plaintext saqlamasdan hash funksiyasiga uzatadigan kod skeleton yozing.",`def hash_password(password: str) -> str:\n    return password\n`,"password", "hashed", 110, [{name:"hash API",type:"containsAny",values:["bcrypt","argon2","scrypt","pbkdf2"]},{name:"password input",type:"containsAll",values:["password"]},{name:"return",type:"containsAll",values:["return"]}]),
code("C++ bounds check","cyber","cpp","medium","Vector indeksini o‘qishdan oldin bounds check qiling.",`int getValue(const std::vector<int>& v, size_t i) {\n    return v[0];\n}`,"v=[10], i=0","10",120,[{name:"vector access",type:"containsAll",values:["vector<int>"]},{name:"bounds",type:"containsAny",values:["i < v.size()","i>=0","at("]},{name:"safe return",type:"containsAny",values:["return v.at","return v[i]"]}]),
code("Secure C# secret handling","cyber","csharp","hard","Secretni source code ichiga hardcode qilmasdan environmentdan olishga ishora qiling.",`string secret = "demo";\nreturn secret;`,`environment secret`,`secret`,120,[{name:"environment",type:"containsAny",values:["Environment.GetEnvironmentVariable","GetEnvironmentVariable"]},{name:"no hardcode",type:"forbidAny",values:["secret = \"","secret=\'"]}]),
q("XSS himoyasi","cyber","easy","User input HTML sifatida to‘g‘ridan-to‘g‘ri render qilinsa qaysi xavf tug‘ilishi mumkin?",["XSS","DNS only","CPU leak","Race condition"],0),
q("Least privilege","cyber","easy","Security'dagi least privilege tamoyili nimani anglatadi?",["Har userga admin berish","Faqat zarur ruxsatlarni berish","Parolni ochiq saqlash","Barcha portlarni ochish"],1),
q("MFA","cyber","easy","MFA nimani anglatadi?",["Multiple Factor Authentication","Managed File Array","Memory Fast Access","Main Firewall Adapter"],0),
q("CSRF","cyber","medium","CSRF asosan nimaga bog‘liq?",["Authenticated user nomidan istalmagan request yuborilishi","RAM to‘lishi","CSS injection","GPU driver"],0),
q("Dependency security","cyber","medium","Third-party package vulnerabilitylarini kuzatishning to‘g‘ri usuli qaysi?",["Audit/dependency scanner ishlatish","Hech qachon update qilmaslik","Secretsni issue'ga yozish","Random package o‘rnatish"],0),

q("Design system","ux","easy","Design systemning asosiy foydasi nima?",["Faqat logo saqlash","UI komponentlari va qoidalarni izchil boshqarish","Serverni tezlashtirish","Database backup"],1),
q("Contrast","ux","easy","Matn va fon kontrasti nima uchun muhim?",["Accessibility va readability","Faqat animation uchun","SQL uchun","API auth uchun"],0),
q("User flow","ux","easy","User flow nimani ko‘rsatadi?",["Foydalanuvchining vazifani bajarishdagi qadamlarini","Database schema","CPU threads","DNS records"],0),
q("Usability test","ux","medium","Usability testingda foydalanuvchi nima qiladi?",["Real interface bilan vazifalarni bajaradi","Server restart qiladi","Database migrate qiladi","Compiler yozadi"],0),
q("Responsive design","ux","easy","Responsive design nimani anglatadi?",["Faqat desktop","Turli ekran o‘lchamlariga moslashish","Faqat mobil app","Faqat print"],1),
code("Accessible button","ux","easy","Interaktiv control sifatida button ishlating va labelni aniq yozing.",`<div onclick="save()">Save</div>`,"HTML","accessible button",80,[{name:"button element",type:"containsAll",values:["<button"]},{name:"label",type:"containsAny",values:["Save","Saqlash"]},{name:"no fake div click",type:"forbidAny",values:["onclick="]}]),
q("Information architecture","ux","medium","Information architecture nimani tashkil qiladi?",["Kontent va navigatsiya strukturasini","Parol hashini","GPU memoryni","DNS cache"],0),
q("Cognitive load","ux","hard","Ortiqcha murakkab interface foydalanuvchiga nima keltirishi mumkin?",["Cognitive load oshishi","CPU cache oshishi","Database index avtomatik paydo bo‘lishi","SSL kuchayishi"],0)
]
async function main(){
  const skills=[['React.js','web'],['Node.js','web'],['TypeScript','web'],['Python','ai'],['PyTorch','ai'],['Cyber Security','cyber'],['OWASP','cyber'],['Figma','ux'],['UI Design','ux'],['UX Research','ux'],['C++','ai'],['C#','web']];
  for(const [name,category] of skills) await prisma.skill.upsert({where:{name},update:{category},create:{name,category}});
  for(const c of challenges){const slug=(c.category+'-'+c.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');await prisma.challenge.upsert({where:{slug},update:{...c,quiz:c.quiz??undefined},create:{...c,slug,quiz:c.quiz??undefined}})}
  console.log(`Seeded ${challenges.length} real challenge records and ${skills.length} skills. No users, news, events or demo leaderboard records are created.`);
