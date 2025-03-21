import dotenv from 'dotenv'

import { normalizeRelations } from './helpers'

dotenv.config()

function syncLikesFromServer(serverLikes, likedStores, lsKey) {
  const likes = serverLikes.reduce((acc, id) => {
    acc[id] = true
    return acc
  }, {})

  Object.assign(likedStores, likes)
  localStorage.setItem(lsKey, JSON.stringify(likedStores))

  return likedStores
}

const actions = {
  async nuxtServerInit({ commit }) {
    process.env.NODE_ENV == 'development'
      ? this.commit('setIsDev', true)
      : this.commit('setIsDev', false)
  },
  getDonations({ state }) {
    return fetch(`${state.baseURL}donationAdresses.json`)
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },

  getStores({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}api/stores`)
      .then(({ data: { data } }) => {
        commit('setStores', data.stores)
        commit('setConfiguration', data.configuration)
        commit('setStorePages', data.pages)

        return data
      })
      .catch(({ response }) => {
        return Promise.reject({
          statusCode: response.status,
          message: response.data.message,
        })
      })
  },
  async getRestStores({ state, commit }) {
    const pages = state.storePages
    const requests = []

    for (let i = 1; i < pages; i++) {
      const url = `${state.baseURL}api/stores?page=${i}`
      requests.push(this.$axios.get(url))
    }

    const responses = await Promise.allSettled(requests)

    const restStores = responses.reduce((acc, { status, value }) => {
      if (status === 'fulfilled') {
        acc.push(...value.data.data.stores)
      }
      return acc
    }, [])

    commit('updateStores', restStores)
  },
  async getStore({ state, commit }, data) {
    try {
      const url = `${state.baseURL}api/storeinfo/?id=${data.id}`
      const { data: response } = await this.$axios.get(url)

      const stores = response.related ?? []
      response.related = stores.map((store) => store.id)

      commit('updateStores', stores)

      commit('setConfiguration', response.configuration)
      commit('setSelectedStore', response)

      return response
    } catch (err) {
      return Promise.reject({
        statusCode: err.status,
        message: err.message,
      })
    }
  },
  addStore(
    { state },
    {
      name: name,
      description: description,
      url: url,
      uri: uri,
      sector: sector,
      digitalGoods: digitalGoods,
      contributor: contributor,
      recaptcha: recaptcha,
    }
  ) {
    let params = {
      accepted: {
        BTC: { modes: ['payments'] },
        BTCLN: { modes: ['payments'] },
      },
      name: encodeURIComponent(name),
      description: encodeURIComponent(description),
      URL: encodeURIComponent(url),
      URI: encodeURIComponent(uri),
      contributor: contributor,
      'g-recaptcha-response': recaptcha,
    }

    return fetch(`${state.baseURL}api/addStore`, {
      method: 'POST',
      body: JSON.stringify(params),
    })
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  addEvent({ state }, payload) {
    return this.$axios
      .post(`${state.baseURL}api/event`, payload)
      .then((response) => {
        if (response.status === 200) {
          return response.data
        }
      })
      .catch((e) => {
        return e.response.data
      })
  },
  addStoreUpdate({ state, commit }, { id: id, body: body }) {
    const debugPwd = null //process.env.debugPwd;
    const url = `${state.baseURL}api/field?id=${id}${
      debugPwd ? '&pwd=' + debugPwd : ''
    }`

    return this.$axios
      .put(url, JSON.stringify(body))
      .then((response) => {
        Object.keys(response.data.data).forEach((attr) => {
          if (response.data.data[attr]) {
            const payload = { key: attr, value: body[attr] }
            commit('updateSelectedStore', payload)
          } else {
            console.log(`${attr} -> not modified!`)
          }
        })
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  suggestBan({ state }, { id: id, name: name, message: message }) {
    return fetch(
      `${state.baseURL}api/suggestBan?id=${id}&name=${encodeURIComponent(
        name
      )}&message=${encodeURIComponent(message)}`
    )
      .then((response) => {
        return response.text()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  getStoreVotePaymentRequest(
    { state },
    { id, amount, isUpvote, comment, parent, recaptchaToken }
  ) {
    return fetch(
      `${
        state.baseURL
      }api/get_invoice?amount=${amount}&storeID=${id}&direction=${
        isUpvote ? 'Upvote' : 'Downvote'
      }${comment ? '&comment=' + comment : ''}${
        parent ? '&parent=' + parent : ''
      }${recaptchaToken ? '&g-recaptcha-response=' + recaptchaToken : ''}`
    )
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  checkPayment({ state }, { id: id }) {
    return fetch(`${state.baseURL}api2/check_payment?id=${id}`)
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  suggestTags({ state }, { storeId, tags }) {
    const object = {
      taginfo: {
        storeID: storeId,
        add: tags,
      },
    }
    return fetch(`${state.baseURL}api/tag`, {
      method: 'POST',
      body: JSON.stringify(object),
    })
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  suggestTag({ state }, { storeId, tag }) {
    const object = {
      taginfo: {
        storeID: storeId,
        add: [tag],
      },
    }
    return fetch(`${state.baseURL}api/tag`, {
      method: 'POST',
      body: JSON.stringify(object),
    })
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  setSelectedStore({ commit }, store) {
    commit('setSelectedStore', store)
  },
  removeTag({ state }, { storeId: storeId, tag: tag }) {
    const object = {
      taginfo: {
        storeID: storeId,
        remove: [tag],
      },
    }
    return fetch(`${state.baseURL}api/tag`, {
      method: 'POST',
      body: JSON.stringify(object),
    })
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  getWallets({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}wallets.json`)
      .then((response) => {
        commit('setWallets', response.data)
        return response.data
      })
      .catch((error) => {
        console.log(error)
      })
  },
  addDiscussion({ state }, payload) {
    return this.$axios
      .post(
        `${state.baseURL}api/discussion?g-recaptcha-response=${payload.recaptchaToken}`,
        payload
      )
      .then((response) => {
        return response.data
      })
      .catch((error) => {
        console.log(error)
        return error.response.data
      })
  },
  getDiscussionReplyPaymentRequest({ state }, payload) {
    return this.$axios
      .post(
        `${state.baseURL}api/discussion${
          payload.recaptchaToken
            ? '?g-recaptcha-response=' + payload.recaptchaToken
            : ''
        }`,
        payload
      )
      .then((response) => {
        return response.data
      })
      .catch((e) => {
        console.log(e)
        return e.response.data
      })
  },
  getDiscussions({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}api/discussion`)
      .then((response) => {
        if (response.status === 200) {
          const { data } = response.data

          const {
            last_active_stores: lastActiveStores,
            last_events,
            ...rest
          } = data

          const [stores, activeStoresDiscussions] = lastActiveStores.reduce(
            (acc, storeDiscussion) => {
              const { reviews, discussions, ...store } = storeDiscussion
              acc[0].push(store)
              acc[1].push(
                normalizeRelations({ store, reviews, discussions }, ['store'])
              )
              return acc
            },
            [[], []]
          )

          const [eventStores, lastEvents] = last_events.reduce(
            (acc, { event, ...store }) => {
              acc[0].push(store)
              acc[1].push(normalizeRelations({ store, event }, ['store']))
              return acc
            },
            [[], []]
          )

          commit('updateStores', [...stores, ...eventStores])

          commit('setDiscussions', {
            last_active_stores: activeStoresDiscussions,
            last_events: lastEvents,
            ...rest,
          })
          commit('setConfiguration', data.configuration)
        }
      })
      .catch(console.error)
  },
  getDiscussion({ state, commit }, id) {
    return this.$axios
      .get(`${state.baseURL}api/discussion?id=${id}`)
      .then((response) => {
        if (response.status === 200) {
          const { data } = response.data
          commit('setConfiguration', response.data.data.configuration)
          return data
        }
      })
      .catch(console.error)
  },

  donateFaucetsRequest({ state, commit }, { data }) {
    return this.$axios
      .post(`${state.baseURL}api/faucet_donation`)
      .then((response) => {
        if (response.status === 200) {
          return response
        }
      })
      .catch(console.error)
  },
  faucetClaim({ state }, { hCaptchaToken, recaptchaToken }) {
    const {
      deviceFingerprint,
      browserFingerprint,
      deviceResolution: { width, height },
    } = state

    const url = new URL(`${state.baseURL}api/lnurl1`)
    url.searchParams.set('bfg', browserFingerprint)
    url.searchParams.set('dfg', deviceFingerprint)
    url.searchParams.set('wfg', `${width}${height}`)
    url.searchParams.set('h-captcha-response', hCaptchaToken)
    url.searchParams.set('g-recaptcha-response', recaptchaToken)

    return this.$axios
      .get(url.toString())
      .then((response) => {
        return response
      })
      .catch(console.error)
  },
  getFaucetStats({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}api/faucetstats`)
      .then((response) => {
        commit('setFaucetStats', response.data.data)
      })
      .catch((error) => {
        console.log(error)
      })
  },
  getStatistics({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}api/statistics`)
      .then((response) => {
        commit('setStatistics', response.data.data)
      })
      .catch((error) => {
        console.log(error)
      })
  },
  likeStore({ state, commit }, { storeId, recaptchaToken, remove }) {
    const lsKey = `lns_likes`
    let likedStores = JSON.parse(localStorage.getItem(lsKey)) ?? {}
    const {
      deviceFingerprint,
      browserFingerprint,
      deviceResolution: { width, height },
    } = state

    likedStores[storeId] = remove ? false : true
    localStorage.setItem(lsKey, JSON.stringify(likedStores))

    commit('setLikeCounter', { storeId, remove })
    commit('updateLikedStores', { storeId, remove })

    const likeUrl = new URL(`${state.baseURL}api/like`)
    likeUrl.searchParams.set('storeID', storeId)
    likeUrl.searchParams.set('remove', `${remove}`)

    if (!remove) {
      likeUrl.searchParams.set('bfg', browserFingerprint)
      likeUrl.searchParams.set('dfg', deviceFingerprint)
      likeUrl.searchParams.set('wfg', `${width}${height}`)
      likeUrl.searchParams.set('g-recaptcha-response', recaptchaToken)
    }

    const response = this.$axios({
      method: 'post',
      url: likeUrl.toString(),
      validateStatus: false,
    }).then((res) => {
      if (res.status !== 200 && res.status !== 202) {
        commit('setLikeCounter', { storeId, remove: !remove })
        commit('updateLikedStores', { storeId, remove: !remove })

        // These lines sync the likes from the server with the localStorage
        // const likes = res.data.data.likes
        // commit('setStoreLikes', syncLikesFromServer(likes, likedStores, lsKey))
      }
    })

    return response
  },
  login({ state }, { token, recipient, storeId }) {
    const body = {
      recipient: recipient,
      storeID: storeId,
      'h-captcha-response': token,
    }
    return this.$axios
      .post(`${state.baseURL}api/loginattempt`, body)
      .then((response) => {
        if (response.status === 200) {
          return response.data
        }
      })
      .catch(console.error)
  },
  doFaucetDonation({ state, commit }, { data, recaptchaToken }) {
    return fetch(
      `${state.baseURL}api/faucet_donation?g-recaptcha-response=${recaptchaToken}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  getFaucetDonors({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}api/faucetinfo`)
      .then((response) => {
        if (response.status === 200) {
          commit('setConfiguration', response.data.data.configuration)
          commit('updateFaucetDonors', response.data.data.top_donors)

          const {
            data: {
              data: {
                configuration,
                top_donors,
                claim,
                throttle,
                daily_claim_rate,
                use_hcaptcha,
                max_claim,
              },
              message,
            },
          } = response

          return {
            configuration,
            top_donors,
            claim,
            throttle,
            message,
            daily_claim_rate,
            use_hcaptcha,
            max_claim,
          }
        }
      })
      .catch(console.error)
  },

  getStatus({ state, commit }, { storeId }) {
    return this.$axios
      .get(`${state.baseURL}api/logstatus?id=${storeId}`)
      .then((response) => {
        if (response.status === 200) {
          const { data } = response.data
          commit('updateSelectedStore', {
            key: 'logged',
            value: data.logged,
          })
          commit('updateSelectedStore', {
            key: 'new',
            value: data.new,
          })
          const { settings = {} } = data
          settings.isFirstTime = data.first_time
          commit('selectedStoreSettings', settings)
        }
      })
      .catch(console.error)
  },

  getLoginStatus({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}api/logstatus`)
      .then((response) => {
        if (response.status === 200) {
          const {
            data: { is_admin: isAdmin, ...data },
          } = response.data
          commit('updateLoginStatus', { ...data, isAdmin })
        }
      })
      .catch(console.error)
  },

  logout({ state, commit }) {
    return this.$axios
      .get(`${state.baseURL}api/logout`)
      .then((response) => {
        if (response.status === 200) {
          commit('logout')
          return response.data
        }
      })
      .catch(console.error)
  },
  updateStoreLikes({ commit }) {
    const storeLikes = JSON.parse(localStorage.getItem('lns_likes')) ?? {}
    commit('setStoreLikes', storeLikes)
  },
  deleteStoreField({ state, commit }, { id, field }) {
    const body = { fields: [field] }
    return this.$axios
      .delete(`${state.baseURL}api/field?id=${id}`, { data: body })
      .then((response) => {
        if (response.status === 200) {
          commit('confirmStoreFieldRemoval', { field })
        }
      })
      .catch(console.error)
  },
  addExternalAttribute({ state, commit }, { id, name, value }) {
    const body = { [`${name}`]: value }
    return this.$axios
      .put(`${state.baseURL}api/field?id=${id}`, body)
      .then((response) => {
        if (response.status === 200) {
          const { data } = response.data
          if (data[name]) {
            commit('confirmStoreFieldAddition', { field: name, value })
            return {
              result: response.data.status,
            }
          }
        }
        return {}
      })
      .catch((err) => {
        console.error(err)
        if (err.response && err.response.data) {
          return {
            error: err.response.data.message,
          }
        } else {
          return {
            error: 'Undefined error',
          }
        }
      })
  },
  verifyInvoiceRequest({ state }, { id: id }) {
    return fetch(`${state.baseURL}api2/check_payment?id=${id}`)
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  checkClaimRequest({ state }, { id: id }) {
    return fetch(`${state.baseURL}api/check_claim?id=${id}`)
      .then((response) => {
        return response.json()
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  },
  setSelectedTag({ commit }, tag) {
    commit('updateSelectedTag', { tag, remove: false })
  },

  unsetSelectedTag({ commit }, tag) {
    commit('updateSelectedTag', { tag, remove: true })
  },

  setExcludedTag({ commit }, tag) {
    commit('updateExcludedTag', { tag, remove: false })
  },

  unsetExcludedTag({ commit }, tag) {
    commit('updateExcludedTag', { tag, remove: true })
  },

  selectOneTag({ commit }, tag) {
    commit('setSelectedTags', [])
    commit('setExcludedTags', [])

    commit('updateSelectedTag', { tag })
  },

  updateSocialMedia({ state, commit }, { id, socialArray }) {
    const body = {}
    socialArray.forEach((social) => {
      body[`${social.name}`] = social.url
    })
    return this.$axios
      .put(`${state.baseURL}api/field?id=${id}`, body)
      .then((response) => {
        if (response.status === 200) {
          const { data } = response.data
          socialArray
            .filter((social) => data[social.name])
            .forEach((social) => {
              commit('updateSocialLink', {
                name: social.name,
                href: social.url,
              })
            })
          return response.data
        } else {
          return response.data
        }
      })
      .catch((err) => {
        console.error(err)
        if (err.response && err.response.data) {
          return { error: err.response.data.message }
        } else {
          return { error: 'Undefined error' }
        }
      })
  },
  removeSocialMedia({ state, commit }, { id, socialToRemove }) {
    const body = {
      fields: socialToRemove,
    }
    return this.$axios
      .delete(`${state.baseURL}api/field?id=${id}`, { data: body })
      .then((response) => {
        if (response.status === 200) {
          const { data } = response.data
          Object.keys(data)
            .filter((name) => data[name])
            .forEach((name) => {
              commit('removeSocialLink', { name })
            })
        }
        return response.data
      })
      .catch((err) => {
        console.error('delete error: ', err)
        if (err.response && err.response.data) {
          return { error: err.response.data.message }
        } else {
          return { error: 'Undefined error' }
        }
      })
  },
  updateImage({ commit, state }, data) {
    console.log(data)
    return this.$axios.post(`${state.baseURL}api/image`, null, { params: data })
  },
  processRoute({ commit, state }, route) {
    const tagsCheckbox = []
    const checkedTags = []
    const excludedTags = []
    let safeMode = false
    let selectedSort = 'best'
    let searchQuery = ''
    if (route.query.safemode) {
      safeMode = route.query.safemode
    }
    if (route.query.sort) {
      selectedSort = route.query.sort
    }
    if (route.query.search) {
      searchQuery = route.query.search
    }
    if (route.query.tags) {
      const routeTags = route.query.tags.split(',').map((x) => decodeURI(x))

      for (const tag of routeTags) {
        tagsCheckbox.push(tag)
        checkedTags[state.tags.indexOf(tag)] = tag
      }
    }

    if (route.query.exclude) {
      const routeExcludedTags = route.query.exclude
        .split(',')
        .map((x) => decodeURI(x))

      for (const tag of routeExcludedTags) {
        excludedTags.push(tag)
      }
    }

    commit('setSelectedTags', tagsCheckbox)
    commit('setExcludedTags', excludedTags)

    return {
      safeMode,
      selectedSort,
      searchQuery,
    }
  },
  toggleFilterByFavoritesStores({ commit, state }) {
    commit('updateFilterFavoriteStores', !state.filterByFavorites)
  },
  async loadImagePreview({ commit, state }, { store, imagePath }) {
    const ytRegex =
      /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/))([\w\-]+)(\S+)?$/
    if (ytRegex.test(imagePath)) {
      const videoId = ytRegex.exec(imagePath)[5]
      return {
        type: 'youtube',
        url: `https://youtube.com/embed/${videoId}`,
      }
    } else {
      try {
        const response = await this.$axios.post(
          `${state.baseURL}api/image?storeID=${store.id}&source=${imagePath}`
        )
        if (response.status === 200) {
          return {
            type: 'image',
            filename: response.data.data.media,
            url: `${state.baseURL}thumbnails/${response.data.data.media}`,
          }
        }
      } catch (err) {
        console.error('set preview image error: ', err)
        if (err.response && err.response.data) {
          return { error: err.response.data.message }
        } else {
          return { error: 'Undefined error' }
        }
      }
    }
    return {
      type: 'unknown',
      url: null,
    }
  },
  confirmImageSelection(
    { state, commit },
    { storeId, position, media, isHomepage, mediaType }
  ) {
    const maxPosition = state.selectedStore.media.main.length
    if (position > maxPosition) {
      position = maxPosition
    }
    const url = `${state.baseURL}api/image?storeID=${storeId}&position=${position}&media=${media}&homepage=${isHomepage}`
    return this.$axios
      .put(url)
      .then((response) => {
        if (response.status === 200) {
          const type = mediaType === 'image' ? 'IMAGE' : 'VIDEO'
          const data = {
            homepage: isHomepage,
            link: media,
            type: type,
            position: position,
          }
          commit('addStoreMedia', data)
          return response.data
        }
        return { error: 'Undefined error with status 200' }
      })
      .catch((err) => {
        console.error('confirm image error: ', err)
        if (err.response && err.response.data) {
          return { error: err.response.data.message }
        } else {
          return { error: 'Undefined error' }
        }
      })
  },
  deleteStoreImage({ commit, state }, { id, position }) {
    return this.$axios
      .delete(`${state.baseURL}api/image?storeID=${id}&position=${position}`)
      .then((response) => {
        const { data } = response
        if (response.status === 200) {
          if (data.status === 'success') {
            commit('removeStoreMedia', { position: position })
            return {
              message: data.message,
            }
          }
          return {
            error: data.message,
          }
        }
        return {
          error: data.message ? data.message : 'Unknown error',
        }
      })
      .catch((err) => {
        console.error('Got an error')
        if (err.response && err.response.data) {
          return { error: err.response.data.message }
        } else {
          return { error: 'Undefined error' }
        }
      })
  },
  setHomeImage({ commit, state }, { position, storeID }) {
    return this.$axios
      .put(
        `${state.baseURL}api/image?storeID=${storeID}&position=${position}&homepage=true`
      )
      .then((response) => {
        if (response.status === 200) {
          const { data } = response
          commit('updateStoreHomeImage', { position })
          return { message: data.status.message }
        } else {
          return { error: 'Unknown error while trying to update image' }
        }
      })
      .catch((err) => {
        console.error(
          'Got an error while trying to set homepage image. err: ',
          err
        )
        if (err.response && err.response.data) {
          return { error: err.response.data.message }
        } else {
          return { error: 'Undefined error' }
        }
      })
  },
  getPreview({ state }, { url }) {
    return this.$axios
      .get(`${state.baseURL}api/preview?url=${url}`)
      .then((response) => {
        const { data } = response
        if (response.status === 200) {
          return {
            name: data.data.name ? data.data.name : '',
            description: data.data.description ? data.data.description : '',
            success: true,
          }
        } else {
          return {
            message: data.data.message,
            success: false,
          }
        }
      })
      .catch((err) => {
        console.error('Error while obtaining store metadata. err: ', err)
        return {
          message: err.response.data.message,
          success: false,
        }
      })
  },
  setScrolledStores({ commit }, storesCount) {
    commit('updateScrolledStores', storesCount)
  },

  async getAnnouncements({ commit, state }) {
    const version = state.configuration.version

    if (version) {
      const {
        data: {
          data: {
            announcements: items,
            configuration,
            last_activity: lastActivity,
          },
        },
      } = await this.$axios.get(`${state.baseURL}api/announcement`)

      commit('updateAnnouncements', { configuration, items })
      commit('updateLastActivity', lastActivity)

      return true
    }

    return false
  },

  async getStoreSummary({ commit, state }) {
    const {
      data: {
        data: { summary },
      },
    } = await this.$axios.get(`${state.baseURL}api/storesummary`)

    const storeSummary = summary.map((store) => ({
      text: `${store.name} (${store.rooturl})`,
      value: store.id,
    }))

    commit('updateStoreSummary', storeSummary)
  },
  updateSettings(
    { state, commit },
    { email, notifications, accepted, storeId }
  ) {
    const body = {
      email: email,
      notifications: {
        new_features: notifications.features,
        new_reviews: notifications.reviews,
      },
      accepted: {
        BTC: accepted.BTC,
        'BTC-LN': accepted.BTCLN,
      },
    }
    return this.$axios
      .post(`${state.baseURL}api/settings?id=${storeId}`, body)
      .then((response) => {
        const { data } = response
        if (response.status === 200) {
          commit('selectedStoreSettings', body)
          commit('updateFirstTime')
          commit('updateSelectedStore', { email: email })
          return data.status
        }
        throw new Error(data.data.message)
      })
      .catch((err) => {
        if (err.response && err.response.data) {
          return { error: err.response.data.message }
        } else {
          return { error: 'Undefined error' }
        }
      })
  },
  updateFirstTime({ commit }) {
    commit('updateFirstTime')
  },
  async getPopularSearches({ commit, state }) {
    const {
      data: {
        data: { searches },
      },
    } = await this.$axios.get(`${state.baseURL}api/search`)

    const [stores, mappedSearches] = searches.reduce(
      (acc, search) => {
        acc[0].push(...search.stores)
        acc[1].push(normalizeRelations(search, ['stores']))
        return acc
      },
      [[], []]
    )

    commit('updateStores', stores)
    commit('updatePopularSearches', mappedSearches)
  },
  setDeviceFingerprint({ commit }, { deviceFingerprint }) {
    commit('setDeviceFingerprint', deviceFingerprint)
  },

  setBrowserFingerprint({ commit }, { browserFingerprint }) {
    commit('setBrowserFingerprint', browserFingerprint)
  },

  setDeviceResolution({ commit }, deviceResolution) {
    commit('setDeviceResolution', deviceResolution)
  },
  updateLastDiscussionTime({ commit }, { discussionTime }) {
    localStorage.setItem('last_comment_seen', discussionTime)
    commit('updateLastCommentSeenTimestamp', Number(discussionTime))
  },
  getLastDiscussionTimestamp({ commit }) {
    const lastCommentSeen = Number(localStorage.getItem('last_comment_seen'))

    const timestamp = !Number.isNaN(lastCommentSeen) ? lastCommentSeen : 0

    commit('updateLastCommentSeenTimestamp', timestamp)
  },

  deleteReply({ state }, { replyId }) {
    return this.$axios.delete(`${state.baseURL}api/comment`, {
      data: {
        comments: [replyId],
      },
    })
  },
}

export default actions
