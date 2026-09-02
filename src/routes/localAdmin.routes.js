import { useState } from 'react';

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    stats: { usersCount: 0, challengesCount: 0, submissionsCount: 0 },
    pendingRequests: [],
    topUsers: []
  });

  // Backend'ga kirish va ma'lumotlarni yuklash
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/local-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const result = await res.json();

      if (result.success) {
        setData(result);
        setIsAuth(true);
      } else {
        alert(result.message || "Parol noto'g'ri!");
      }
    } catch (err) {
      alert("Backend server bilan bog'lanishda xatolik!");
    } finally {
      setLoading(false);
    }
  };

  // Ruxsat berish / Rad etish
  const handleAction = async (attemptId, action) => {
    try {
      const res = await fetch('/api/local-admin/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password
        },
        body: JSON.stringify({ attemptId, action })
      });
      const result = await res.json();

      if (result.success) {
        setData(prev => ({
          ...prev,
          pendingRequests: prev.pendingRequests.filter(req => req.id !== attemptId)
        }));
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("Amalni bajarishda xatolik yuz berdi");
    }
  };

  // 1. Parol oynasi (Agar login qilinmagan bo'lsa)
  if (!isAuth) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl">🔐</span>
            <h2 className="text-2xl font-bold text-white mt-2">Local Admin Panel</h2>
            <p className="text-gray-400 text-sm mt-1">DevRank UZ Boshqaruv Markazi</p>
          </div>
          <input
            type="password"
            placeholder="Admin parolini kiriting..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl mb-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-white transition-colors cursor-pointer"
          >
            {loading ? "Tekshirilmoqda..." : "Kirish"}
          </button>
        </form>
      </div>
    );
  }

  // 2. Asosiy Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Yuqori panel */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2">
              🛠️ DevRank Admin Panel
            </h1>
            <p className="text-gray-400 text-sm mt-1">Lokal ma'lumotlar bazasi va so'rovlar nazorati</p>
          </div>
          <button
            onClick={() => { setIsAuth(false); setPassword(''); }}
            className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
          >
            Chiqish ✕
          </button>
        </div>

        {/* 1. Platforma Statistikasi */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-400 text-sm font-medium">👥 Jami foydalanuvchilar</p>
            <h3 className="text-4xl font-bold text-blue-400 mt-2">{data.stats.usersCount}</h3>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-400 text-sm font-medium">💻 Jami vazifalar (Challenges)</p>
            <h3 className="text-4xl font-bold text-yellow-400 mt-2">{data.stats.challengesCount}</h3>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-400 text-sm font-medium">🚀 Yuborilgan javoblar</p>
            <h3 className="text-4xl font-bold text-green-400 mt-2">{data.stats.submissionsCount}</h3>
          </div>
        </div>

        {/* 2. Kutilayotgan so'rovlar (PENDING Submissions) */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            ⏳ Kutilayotgan ruxsat so'rovlari 
            <span className="px-2.5 py-0.5 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full">
              {data.pendingRequests.length}
            </span>
          </h2>

          {data.pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-sm">Hozircha qayta urinish uchun so'rovlar yo'q.</p>
          ) : (
            <div className="space-y-4">
              {data.pendingRequests.map((req) => (
                <div key={req.id} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-950 p-4 rounded-xl border border-gray-800 gap-4">
                  <div>
                    <h4 className="font-bold text-lg text-white">{req.challenge?.title}</h4>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Foydalanuvchi: <span className="text-blue-400 font-medium">{req.user?.name}</span> ({req.user?.email})
                    </p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button
                      onClick={() => handleAction(req.id, 'APPROVE')}
                      className="flex-1 md:flex-none px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                    >
                      Ruxsat berish ✓
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'REJECT')}
                      className="flex-1 md:flex-none px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                    >
                      Rad etish ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Top Foydalanuvchilar Ro'yxati */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">🏆 Top Foydalanuvchilar Ro'yxati</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-sm">
                  <th className="pb-3">#</th>
                  <th className="pb-3">Ism</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Score</th>
                  <th className="pb-3">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.topUsers.map((user, idx) => (
                  <tr key={user.id} className="text-sm">
                    <td className="py-3 font-bold text-yellow-500">#{idx + 1}</td>
                    <td className="py-3 font-medium text-white">{user.name}</td>
                    <td className="py-3 text-gray-400">{user.email}</td>
                    <td className="py-3 text-blue-400 font-bold">{user.score} pts</td>
                    <td className="py-3 text-gray-300">Level {user.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}