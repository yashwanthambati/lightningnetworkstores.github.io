export const state = () => ({
  announcements: [],
  baseURL: process.env.BASE_URL,
  configuration: { max_comment_size: 250, min_post: 100, min_reply: 100, listing_fee: 1000, min_skip_captcha: 1000, minimum_donation: 1000, maximum_donation_timeout_days: 70},
  discussions: [],
  lastDiscussions: [],
  activeStoreDiscussions: [],
  donations: [],
  excludedTags: [],
  faucetStats: {},
  filterByFavorites: false,
  filteredStores: [],
  filteredTags: [],
  isDev: null,
  likedStores: {},
  loading: false,
  scores: [],
  scrolledStores: 0,
  selectedStore: { logged: false }, // makes components reactive to selectedStore.logged
  selectedStoreSettings: null,
  selectedTags: [],
  stores: [],
  storeSummary: [],
  storeEvents: [],
  tags: [],
  wallets: [],
})

export default state
