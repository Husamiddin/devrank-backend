import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function showMenu() {
  console.log("\n==========================================");
  console.log("🛠️   DEVRANK UZ — LOCAL ALL-IN-ONE ADMIN   🛠️");
  console.log("==========================================");
  console.log("[1] 📊 Platforma statistikasi");
  console.log("[2] ⏳ Kutilayotgan so'rovlar (PENDING submissions)");
  console.log("[3] 🏆 Top foydalanuvchilar ro'yxati");
  console.log("[4] ❌ Chiqish");
  
  rl.question("\nTanlovingiz (1-4): ", async (choice) => {
    switch (choice.trim()) {
      case '1':
        await showStats();
        break;
      case '2':
        await handlePendingRequests();
        break;
      case '3':
        await showUsers();
        break;
      case '4':
        console.log("Admin panel yopildi.");
        await prisma.$disconnect();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log("❌ Noto'g'ri tanlov, qaytadan urinib ko'ring.");
        await showMenu();
    }
  });
}

async function showStats() {
  const usersCount = await prisma.user.count();
  const challengesCount = await prisma.challenge.count();
  const submissionsCount = await prisma.submission.count();
  const pendingCount = await prisma.challengeAttempt.count({ where: { status: "PENDING" } });

  console.log("\n------------------------------------------");
  console.log("📊 PLATFORMA STATISTIKASI:");
  console.log(`👤 Jami foydalanuvchilar: ${usersCount}`);
  console.log(`💻 Jami challenge'lar: ${challengesCount}`);
  console.log(`🚀 Jami yuborilgan submission'lar: ${submissionsCount}`);
  console.log(`⏳ Kutilayotgan so'rovlar: ${pendingCount}`);
  console.log("------------------------------------------");
  
  backToMenu();
}

async function handlePendingRequests() {
  const requests = await prisma.challengeAttempt.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { name: true, email: true } },
      challenge: { select: { title: true } }
    }
  });

  if (requests.length === 0) {
    console.log("\n📭 Hozircha kutilayotgan ruxsat so'rovlari yo'q.");
    return backToMenu();
  }

  console.log(`\n⏳ Topildi: ${requests.length} ta so'rov:\n`);
  requests.forEach((req, idx) => {
    console.log(`[${idx + 1}] Foydalanuvchi: ${req.user.name} (${req.user.email})`);
    console.log(`    Vazifa: ${req.challenge.title}`);
    console.log(`    ID: ${req.id}`);
    console.log(`------------------------------------------`);
  });

  rl.question("\nQaysi birini ko'rib chiqasiz? (Tartib raqamini kiriting yoki 'b' - ortga): ", async (ans) => {
    if (ans.toLowerCase() === 'b') return showMenu();
    
    const index = parseInt(ans) - 1;
    if (isNaN(index) || !requests[index]) {
      console.log("❌ Noto'g'ri raqam kiritildi!");
      return handlePendingRequests();
    }

    const selected = requests[index];
    rl.question(`"${selected.challenge.title}" uchun nima qilamiz?\n[1] Ruxsat berish (Approve - Qayta ishlashga ochish)\n[2] Rad etish (Reject - Bloklash)\nTanlovingiz (1/2): `, async (action) => {
      if (action === '1') {
        await prisma.challengeAttempt.update({
          where: { id: selected.id },
          data: { status: "ACTIVE", attempts: 0, passed: false }
        });
        console.log(`\n✅ Muvaffaqiyatli! ${selected.user.name}ga qayta ishlashga ruxsat berildi.`);
      } else if (action === '2') {
        await prisma.challengeAttempt.update({
          where: { id: selected.id },
          data: { status: "LOCKED", attempts: 2 }
        });
        console.log(`\n❌ So'rov rad etildi va vazifa bloklandi.`);
      } else {
        console.log("❌ Noto'g'ri tanlov.");
      }
      await handlePendingRequests();
    });
  });
}

async function showUsers() {
  const users = await prisma.user.findMany({
    select: { name: true, email: true, score: true, level: true, rank: true },
    orderBy: { score: 'desc' },
    take: 10
  });

  console.log("\n------------------------------------------");
  console.log("🏆 TOP 10 FOYDALANUVCHILAR:");
  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.name} (${u.email}) — Score: ${u.score} | Level: ${u.level} | Rank: #${u.rank}`);
  });
  console.log("------------------------------------------");

  backToMenu();
}

function backToMenu() {
  rl.question("\nAsosiy menyuga qaytish uchun Enter ni bosing...", () => {
    showMenu();
  });
}

showMenu();