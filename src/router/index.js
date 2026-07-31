import { createRouter, createWebHashHistory } from 'vue-router'

// Lazy-loaded views → each becomes its own chunk (smaller initial bundle,
// faster first paint, and one failing route can't block the whole app).
const routes = [
    { path: '/',          name: 'home',      component: () => import('../views/HomeView.vue')      },
    { path: '/members',   name: 'members',   component: () => import('../views/MembersView.vue')   },
    { path: '/play',      name: 'play',      component: () => import('../views/PlayView.vue')      },
    { path: '/study',     name: 'study',     component: () => import('../views/StudyView.vue')     },
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
]

export const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
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
router.afterEach(() => { sessionStorage.removeItem('chunkReloaded') })
