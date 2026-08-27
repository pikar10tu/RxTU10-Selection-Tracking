import { createRouter, createWebHashHistory } from 'vue-router'
import { useAppConfig } from '../composables/useAppConfig.js'
import { useAuthStore } from '../stores/auth.js'
import { isFeatureOpen } from '../utils/featureFlags.js'

// Lazy-loaded views → each becomes its own chunk (smaller initial bundle,
// faster first paint, and one failing route can't block the whole app).
const routes = [
    { path: '/',          name: 'home',      component: () => import('../views/HomeView.vue')      },
    { path: '/members',   name: 'members',   component: () => import('../views/MembersView.vue')   },
    { path: '/play',      name: 'play',      component: () => import('../views/PlayView.vue')      },
    { path: '/study',     name: 'study',     component: () => import('../views/StudyView.vue')     },
    { path: '/study/crcl', name: 'crcl', component: () => import('../views/CrClTrainerView.vue') },
    { path: '/quiz',      name: 'quiz',      component: () => import('../views/QuizView.vue')      },
    { path: '/questions', name: 'questions', component: () => import('../views/QuestionsView.vue') },
    { path: '/review',    name: 'review',    component: () => import('../views/ReviewView.vue')    },
    { path: '/shop',      name: 'shop',      component: () => import('../views/ShopView.vue')      },
    { path: '/admin',     name: 'admin',     component: () => import('../views/AdminView.vue')     },
    { path: '/me',        name: 'me',        component: () => import('../views/MeView.vue')        },
    { path: '/pets',      name: 'pets',      component: () => import('../views/PetsView.vue')      },
    { path: '/tower',     name: 'tower',     component: () => import('../views/TowerView.vue')     },
    { path: '/arena',     name: 'arena',     component: () => import('../views/ArenaView.vue')     },
    { path: '/expedition', name: 'expedition', component: () => import('../views/ExpeditionView.vue') },
    { path: '/play/farm',  name: 'play-farm',  component: () => import('../views/FarmView.vue')    },
    { path: '/play/pets',  name: 'play-pets',  component: () => import('../views/PetHubView.vue')  },
    { path: '/play/games/capsule-rush', name: 'capsule-rush', component: () => import('../views/CapsuleRushView.vue') },
    { path: '/play/games/2048', name: 'g2048', component: () => import('../views/Game2048View.vue') },
    { path: '/play/games/stacker', name: 'stacker', component: () => import('../views/StackerView.vue') },
    // URL ที่ไม่รู้จัก (ลิงก์เก่า/พิมพ์ผิด) → กลับหน้าแรก แทนที่จะขึ้นจอว่างเปล่า
    { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
})

// ── กันเข้าฟีเจอร์ที่ปิดอยู่ผ่านลิงก์ตรง/bookmark เก่า ──
// ซ่อนการ์ดใน UI อย่างเดียวไม่พอ — URL เก่ายังพาเข้าได้
// (เรียก useAuthStore() ใน guard ได้ เพราะ main.js ทำ app.use(pinia) ก่อน app.use(router))
// ⚠️ Expedition: ปิด = "ส่งใหม่ไม่ได้" แต่คนที่ส่งเพ็ทไปแล้วต้องเข้ามากดเก็บของได้เสมอ
const GATED = {
    expedition:     'expeditionOpen',
    'capsule-rush': 'arcadeOpen',
    g2048:          'arcadeOpen',
    stacker:        'arcadeOpen',
}

router.beforeEach((to) => {
    const key = GATED[to.name]
    if (!key) return true

    const auth = useAuthStore()
    const { rawConfig, configLoaded } = useAppConfig()

    // config ยังไม่โหลด → ปล่อยผ่าน แล้วให้ UI จัดการ
    // (เด้งตอนนี้จะเด้งผิดทุกครั้งที่ refresh ค้างอยู่บนหน้านั้น)
    if (!configLoaded.value) return true

    if (isFeatureOpen(rawConfig.value, key, { isAdmin: auth.isAdmin })) return true

    // มีสายผจญภัยค้างอยู่ → เข้าไปกดเก็บของได้ แม้ฟีเจอร์ปิดแล้ว
    if (key === 'expeditionOpen' && auth.userData?.expedition) return true

    return { path: '/play' }
})

// A failed dynamic import is usually a stale chunk after a new deploy — hard
// reload once to fetch the fresh build (guard against a reload loop).
router.onError((err) => {
    const msg = err?.message || ''
    if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg)) {
        if (!sessionStorage.getItem('chunkReloaded')) {
            sessionStorage.setItem('chunkReloaded', '1')
            window.location.reload()
        }
    }
})

// clear the reload-guard once we land somewhere successfully
// โลกประจำโหมด — ตั้ง data-world ให้ CSS เปลี่ยนพื้นหลัง (ดู style.css "โลกประจำโหมด")
// เพ็ท/สนามรบ/ฟาร์มเท่านั้น · หน้าอื่น (เรียน ข้อสอบ สมาชิก) คงพื้นครีมเดิม
// /play เป็นทางแยก จึงไม่ตั้งโลก — ปล่อยให้สีบนการ์ดสองใบเป็นตัวบอกทางเอง
const ROUTE_WORLD = {
  'play-pets': 'pet', pets: 'pet', shop: 'pet',
  arena: 'battle', tower: 'battle', expedition: 'battle',
  'play-farm': 'farm',
}
router.afterEach((to) => {
  sessionStorage.removeItem('chunkReloaded')
  const w = ROUTE_WORLD[to.name]
  if (w) document.body.dataset.world = w
  else delete document.body.dataset.world
})
