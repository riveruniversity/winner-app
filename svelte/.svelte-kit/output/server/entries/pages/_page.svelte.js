import { x as ensure_array_like, y as attr, z as stringify, F as attr_class } from "../../chunks/index.js";
import "clsx";
import { e as escape_html } from "../../chunks/context.js";
function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}
function setCookie(name, value, options = {}) {
  const {
    expireDays = 365,
    maxAge,
    path = "/",
    domain,
    secure = false,
    sameSite = "Lax",
    httpOnly = false
  } = options;
  let cookieString = `${name}=${encodeURIComponent(value)}`;
  cookieString += `; path=${path}`;
  if (maxAge !== void 0) {
    cookieString += `; max-age=${maxAge}`;
  } else {
    const expires = new Date(Date.now() + expireDays * 864e5).toUTCString();
    cookieString += `; expires=${expires}`;
  }
  if (domain) {
    cookieString += `; domain=${domain}`;
  }
  if (secure) {
    cookieString += `; secure`;
  }
  cookieString += `; samesite=${sameSite}`;
  if (httpOnly) {
    cookieString += `; httponly`;
  }
  document.cookie = cookieString;
}
function getStorage(type, cookieOptions = {}) {
  if (type === "local") return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v)
  };
  if (type === "session") return {
    getItem: (k) => sessionStorage.getItem(k),
    setItem: (k, v) => sessionStorage.setItem(k, v)
  };
  return {
    getItem: getCookie,
    setItem: (k, v) => setCookie(k, v, cookieOptions)
  };
}
function persistedState(key, initialValue, options = {}) {
  const {
    storage = "local",
    serializer = JSON,
    syncTabs = true,
    cookieExpireDays,
    cookieOptions = {},
    onWriteError = console.error,
    onParseError = console.error,
    beforeRead = (v) => v,
    beforeWrite = (v) => v
  } = options;
  const finalCookieOptions = {
    ...cookieOptions,
    ...cookieExpireDays !== void 0 && { expireDays: cookieExpireDays }
  };
  const browser = typeof window !== "undefined" && typeof document !== "undefined";
  const storageArea = browser ? getStorage(storage, finalCookieOptions) : null;
  let storedValue;
  try {
    const item = storageArea?.getItem(key);
    storedValue = item ? beforeRead(serializer.parse(item)) : initialValue;
  } catch (error) {
    onParseError(error);
    storedValue = initialValue;
  }
  let state = storedValue;
  if (syncTabs && typeof window !== "undefined" && storage === "local") {
    window.addEventListener("storage", (event) => {
      if (event.key === key && event.storageArea === localStorage) {
        try {
          const newValue = event.newValue ? serializer.parse(event.newValue) : initialValue;
          state = beforeRead(newValue);
        } catch (error) {
          onParseError(error);
        }
      }
    });
  }
  return {
    /**
     * @deprecated Use current to align with Svelte conventions
     */
    get value() {
      return state;
    },
    /**
     * @deprecated Use current to align with Svelte conventions
     */
    set value(newValue) {
      state = newValue;
    },
    get current() {
      return state;
    },
    set current(newValue) {
      state = newValue;
    },
    reset() {
      state = initialValue;
    }
  };
}
const API_BASE = "/api";
const KEY_FIELDS = {
  lists: "listId",
  winners: "winnerId",
  prizes: "prizeId",
  history: "historyId",
  settings: "key",
  backups: "backupId",
  templates: "templateId",
  archive: "listId"
};
function getKeyField(collection) {
  return KEY_FIELDS[collection] || "id";
}
class APIClient {
  /**
   * Generic fetch wrapper with error handling
   */
  async fetch(url, options) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      },
      ...options
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
  /**
   * Get single document or all documents from a collection
   */
  async get(collection, id) {
    try {
      if (id) {
        const url = `${API_BASE}/${collection}/${id}`;
        const response2 = await fetch(url);
        if (response2.status === 404) {
          return null;
        }
        if (!response2.ok) {
          throw new Error(`HTTP error! status: ${response2.status}`);
        }
        return response2.json();
      }
      const response = await fetch(`${API_BASE}/${collection}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error getting from ${collection}:`, error);
      return [];
    }
  }
  /**
   * Get all lists
   */
  async getLists() {
    return await this.get("lists");
  }
  /**
   * Get single list by ID
   */
  async getList(listId) {
    return await this.get("lists", listId);
  }
  /**
   * Get all prizes
   */
  async getPrizes() {
    return await this.get("prizes");
  }
  /**
   * Get single prize by ID
   */
  async getPrize(prizeId) {
    return await this.get("prizes", prizeId);
  }
  /**
   * Get all winners
   */
  async getWinners() {
    return await this.get("winners");
  }
  /**
   * Get single winner by ID
   */
  async getWinner(winnerId) {
    return await this.get("winners", winnerId);
  }
  /**
   * Get all history entries
   */
  async getHistory() {
    return await this.get("history");
  }
  /**
   * Save document to collection
   */
  async save(collection, data) {
    const keyField = getKeyField(collection);
    const docId = data[keyField];
    if (!docId) {
      throw new Error(`Document must have a '${keyField}' field`);
    }
    const result = await this.fetch(`${API_BASE}/${collection}`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return result.id || docId;
  }
  /**
   * Delete document from collection
   */
  async delete(collection, id) {
    const response = await fetch(`${API_BASE}/${collection}/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return id;
  }
  /**
   * Update specific fields in a winner document
   */
  async updateWinner(winnerId, updateData) {
    const existingWinner = await this.getWinner(winnerId);
    if (!existingWinner) {
      throw new Error(`Winner ${winnerId} not found`);
    }
    const updatedWinner = {
      ...existingWinner,
      ...updateData
    };
    await this.save("winners", updatedWinner);
    return updatedWinner;
  }
  /**
   * Batch fetch multiple collections in a single request
   */
  async batchFetch(requests) {
    try {
      const response = await fetch(`${API_BASE}/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests })
      });
      if (!response.ok) {
        throw new Error(`Failed to batch fetch: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error("Error in batch fetch:", error);
      const emptyResults = {};
      requests.forEach((req) => {
        emptyResults[req.collection] = [];
      });
      return emptyResults;
    }
  }
  /**
   * Batch save multiple documents in a single request
   */
  async batchSave(operations) {
    const response = await fetch(`${API_BASE}/batch-save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ operations })
    });
    if (!response.ok) {
      throw new Error(`Failed to batch save: ${response.statusText}`);
    }
    return response.json();
  }
  /**
   * Archive a list (save metadata to archive, delete original)
   */
  async archiveList(listId) {
    const list = await this.getList(listId);
    if (!list) {
      throw new Error(`List ${listId} not found`);
    }
    const archiveEntry = {
      listId: list.listId,
      metadata: { ...list.metadata },
      archivedAt: Date.now()
    };
    await this.save("archive", archiveEntry);
    await this.delete("lists", listId);
  }
  /**
   * Save settings to backend
   */
  async saveSettings(key, value) {
    await this.save("settings", { key, value, timestamp: Date.now() });
  }
  /**
   * Check API health
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
const apiClient = new APIClient();
class SettingsStore {
  // General settings
  _preventDuplicates = persistedState("settings_preventDuplicates", false);
  _preventSamePrize = persistedState("settings_preventSamePrize", false);
  _hideEntryCounts = persistedState("settings_hideEntryCounts", false);
  _enableDebugLogs = persistedState("settings_enableDebugLogs", false);
  _enableWebhook = persistedState("settings_enableWebhook", false);
  _webhookUrl = persistedState("settings_webhookUrl", "");
  // Theme settings
  _fontFamily = persistedState("settings_fontFamily", "Open Sans");
  _primaryColor = persistedState("settings_primaryColor", "#6366f1");
  _secondaryColor = persistedState("settings_secondaryColor", "#8b5cf6");
  _selectionColor = persistedState("settings_selectionColor", "#10b981");
  _backgroundType = persistedState("settings_backgroundType", "gradient");
  _customBackgroundImage = persistedState("settings_customBackgroundImage", null);
  // Selection display settings
  _selectionMode = persistedState("settings_selectionMode", "all-at-once");
  _displayEffect = persistedState("settings_displayEffect", "fade-in");
  _displayDuration = persistedState("settings_displayDuration", 0.5);
  _stableGrid = persistedState("settings_stableGrid", false);
  _preSelectionDelay = persistedState("settings_preSelectionDelay", 0);
  _delayVisualType = persistedState("settings_delayVisualType", "none");
  // Sound settings
  _soundDuringDelay = persistedState("settings_soundDuringDelay", "none");
  _soundEndOfDelay = persistedState("settings_soundEndOfDelay", "none");
  _soundDuringReveal = persistedState("settings_soundDuringReveal", "none");
  // Celebration settings
  _celebrationEffect = persistedState("settings_celebrationEffect", "confetti");
  _celebrationDuration = persistedState("settings_celebrationDuration", 4);
  _celebrationAutoTrigger = persistedState("settings_celebrationAutoTrigger", true);
  // SMS Template
  _smsTemplate = persistedState("settings_smsTemplate", "Congratulations {name}! You won {prize}. Your code: {contactId}");
  // Getters and setters using .current property
  get preventDuplicates() {
    return this._preventDuplicates.current;
  }
  set preventDuplicates(v) {
    this._preventDuplicates.current = v;
  }
  get preventSamePrize() {
    return this._preventSamePrize.current;
  }
  set preventSamePrize(v) {
    this._preventSamePrize.current = v;
  }
  get hideEntryCounts() {
    return this._hideEntryCounts.current;
  }
  set hideEntryCounts(v) {
    this._hideEntryCounts.current = v;
  }
  get enableDebugLogs() {
    return this._enableDebugLogs.current;
  }
  set enableDebugLogs(v) {
    this._enableDebugLogs.current = v;
  }
  get enableWebhook() {
    return this._enableWebhook.current;
  }
  set enableWebhook(v) {
    this._enableWebhook.current = v;
  }
  get webhookUrl() {
    return this._webhookUrl.current;
  }
  set webhookUrl(v) {
    this._webhookUrl.current = v;
  }
  get fontFamily() {
    return this._fontFamily.current;
  }
  set fontFamily(v) {
    this._fontFamily.current = v;
  }
  get primaryColor() {
    return this._primaryColor.current;
  }
  set primaryColor(v) {
    this._primaryColor.current = v;
  }
  get secondaryColor() {
    return this._secondaryColor.current;
  }
  set secondaryColor(v) {
    this._secondaryColor.current = v;
  }
  get selectionColor() {
    return this._selectionColor.current;
  }
  set selectionColor(v) {
    this._selectionColor.current = v;
  }
  get backgroundType() {
    return this._backgroundType.current;
  }
  set backgroundType(v) {
    this._backgroundType.current = v;
  }
  get customBackgroundImage() {
    return this._customBackgroundImage.current;
  }
  set customBackgroundImage(v) {
    this._customBackgroundImage.current = v;
  }
  get selectionMode() {
    return this._selectionMode.current;
  }
  set selectionMode(v) {
    this._selectionMode.current = v;
  }
  get displayEffect() {
    return this._displayEffect.current;
  }
  set displayEffect(v) {
    this._displayEffect.current = v;
  }
  get displayDuration() {
    return this._displayDuration.current;
  }
  set displayDuration(v) {
    this._displayDuration.current = v;
  }
  get stableGrid() {
    return this._stableGrid.current;
  }
  set stableGrid(v) {
    this._stableGrid.current = v;
  }
  get preSelectionDelay() {
    return this._preSelectionDelay.current;
  }
  set preSelectionDelay(v) {
    this._preSelectionDelay.current = v;
  }
  get delayVisualType() {
    return this._delayVisualType.current;
  }
  set delayVisualType(v) {
    this._delayVisualType.current = v;
  }
  get soundDuringDelay() {
    return this._soundDuringDelay.current;
  }
  set soundDuringDelay(v) {
    this._soundDuringDelay.current = v;
  }
  get soundEndOfDelay() {
    return this._soundEndOfDelay.current;
  }
  set soundEndOfDelay(v) {
    this._soundEndOfDelay.current = v;
  }
  get soundDuringReveal() {
    return this._soundDuringReveal.current;
  }
  set soundDuringReveal(v) {
    this._soundDuringReveal.current = v;
  }
  get celebrationEffect() {
    return this._celebrationEffect.current;
  }
  set celebrationEffect(v) {
    this._celebrationEffect.current = v;
  }
  get celebrationDuration() {
    return this._celebrationDuration.current;
  }
  set celebrationDuration(v) {
    this._celebrationDuration.current = v;
  }
  get celebrationAutoTrigger() {
    return this._celebrationAutoTrigger.current;
  }
  set celebrationAutoTrigger(v) {
    this._celebrationAutoTrigger.current = v;
  }
  get smsTemplate() {
    return this._smsTemplate.current;
  }
  set smsTemplate(v) {
    this._smsTemplate.current = v;
  }
  /**
   * Apply theme settings to CSS variables
   */
  applyTheme() {
    return;
  }
  /**
   * Save a single setting to the backend
   */
  async saveSingleSetting(key, value) {
    await apiClient.saveSettings(key, value);
  }
  /**
   * Save multiple settings to the backend
   */
  async saveMultipleSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
      await this.saveSingleSetting(key, value);
    }
  }
  /**
   * Get all settings as a plain object
   */
  getAllSettings() {
    return {
      preventDuplicates: this.preventDuplicates,
      preventSamePrize: this.preventSamePrize,
      hideEntryCounts: this.hideEntryCounts,
      enableDebugLogs: this.enableDebugLogs,
      enableWebhook: this.enableWebhook,
      webhookUrl: this.webhookUrl,
      fontFamily: this.fontFamily,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      selectionColor: this.selectionColor,
      backgroundType: this.backgroundType,
      customBackgroundImage: this.customBackgroundImage,
      selectionMode: this.selectionMode,
      displayEffect: this.displayEffect,
      displayDuration: this.displayDuration,
      stableGrid: this.stableGrid,
      preSelectionDelay: this.preSelectionDelay,
      delayVisualType: this.delayVisualType,
      soundDuringDelay: this.soundDuringDelay,
      soundEndOfDelay: this.soundEndOfDelay,
      soundDuringReveal: this.soundDuringReveal,
      celebrationEffect: this.celebrationEffect,
      celebrationDuration: this.celebrationDuration,
      celebrationAutoTrigger: this.celebrationAutoTrigger,
      smsTemplate: this.smsTemplate
    };
  }
  /**
   * Reset all settings to defaults
   */
  resetAll() {
    this._preventDuplicates.reset();
    this._preventSamePrize.reset();
    this._hideEntryCounts.reset();
    this._enableDebugLogs.reset();
    this._enableWebhook.reset();
    this._webhookUrl.reset();
    this._fontFamily.reset();
    this._primaryColor.reset();
    this._secondaryColor.reset();
    this._selectionColor.reset();
    this._backgroundType.reset();
    this._customBackgroundImage.reset();
    this._selectionMode.reset();
    this._displayEffect.reset();
    this._displayDuration.reset();
    this._stableGrid.reset();
    this._preSelectionDelay.reset();
    this._delayVisualType.reset();
    this._soundDuringDelay.reset();
    this._soundEndOfDelay.reset();
    this._soundDuringReveal.reset();
    this._celebrationEffect.reset();
    this._celebrationDuration.reset();
    this._celebrationAutoTrigger.reset();
    this._smsTemplate.reset();
  }
}
const settingsStore = new SettingsStore();
const ID_FIELDS = {
  lists: "listId",
  prizes: "prizeId",
  winners: "winnerId",
  history: "historyId"
};
class DataStore {
  // Reactive state using $state rune
  lists = [];
  prizes = [];
  winners = [];
  history = [];
  loading = { lists: false, prizes: false, winners: false, history: false };
  /**
   * Load a single collection from the API
   */
  async load(collection) {
    this.loading[collection] = true;
    try {
      switch (collection) {
        case "lists":
          this.lists = await apiClient.getLists();
          break;
        case "prizes":
          this.prizes = await apiClient.getPrizes();
          break;
        case "winners":
          this.winners = await apiClient.getWinners();
          break;
        case "history":
          this.history = await apiClient.getHistory();
          break;
      }
    } catch (error) {
      console.error(`Error loading ${collection}:`, error);
      throw error;
    } finally {
      this.loading[collection] = false;
    }
  }
  /**
   * Load all collections in parallel
   */
  async loadAll() {
    await Promise.all([
      this.load("lists"),
      this.load("prizes"),
      this.load("winners"),
      this.load("history")
    ]);
  }
  /**
   * Save an item to a collection and reload
   */
  async save(collection, item) {
    await apiClient.save(collection, item);
    await this.load(collection);
  }
  /**
   * Delete an item from a collection and reload
   */
  async delete(collection, id) {
    await apiClient.delete(collection, id);
    await this.load(collection);
  }
  /**
   * Get an item by ID from a collection
   */
  getById(collection, id) {
    const idField = ID_FIELDS[collection];
    const items = this[collection];
    return items.find((item) => item[idField] === id);
  }
  /**
   * Get a list by ID
   */
  getListById(listId) {
    return this.lists.find((l) => l.listId === listId);
  }
  /**
   * Get a prize by ID
   */
  getPrizeById(prizeId) {
    return this.prizes.find((p) => p.prizeId === prizeId);
  }
  /**
   * Get a winner by ID
   */
  getWinnerById(winnerId) {
    return this.winners.find((w) => w.winnerId === winnerId);
  }
  /**
   * Get history entry by ID
   */
  getHistoryById(historyId) {
    return this.history.find((h) => h.historyId === historyId);
  }
  /**
   * Update a winner's pickup status
   */
  async toggleWinnerPickup(winnerId) {
    const winner = this.getWinnerById(winnerId);
    if (!winner) {
      throw new Error(`Winner ${winnerId} not found`);
    }
    const updatedWinner = {
      ...winner,
      pickedUp: !winner.pickedUp,
      pickupTimestamp: !winner.pickedUp ? Date.now() : void 0,
      pickupStation: !winner.pickedUp ? "Manual" : void 0
    };
    await this.save("winners", updatedWinner);
  }
  /**
   * Update winner SMS status
   */
  async updateWinnerSmsStatus(winnerId, status, messageId) {
    const winner = this.getWinnerById(winnerId);
    if (!winner) {
      throw new Error(`Winner ${winnerId} not found`);
    }
    const updatedWinner = { ...winner, sms: { status, messageId, timestamp: Date.now() } };
    await this.save("winners", updatedWinner);
  }
}
const dataStore = new DataStore();
class SetupStore {
  // Persisted selection state
  _selectedListIds = persistedState("setup_selectedListIds", []);
  _selectedPrizeId = persistedState("setup_selectedPrizeId", "");
  _winnersCount = persistedState("setup_winnersCount", 1);
  // Getters/setters using .current property
  get selectedListIds() {
    return this._selectedListIds.current;
  }
  set selectedListIds(value) {
    this._selectedListIds.current = value;
  }
  get selectedPrizeId() {
    return this._selectedPrizeId.current;
  }
  set selectedPrizeId(value) {
    this._selectedPrizeId.current = value;
  }
  get winnersCount() {
    return this._winnersCount.current;
  }
  set winnersCount(value) {
    this._winnersCount.current = value;
  }
  /**
   * Computed: Calculate eligible entries from selected lists
   * Accounts for preventSamePrize exclusions
   */
  get eligibleEntries() {
    const selectedIds = this._selectedListIds.current;
    const prizeId = this._selectedPrizeId.current;
    let total = selectedIds.reduce(
      (sum, listId) => {
        const list = dataStore.lists.find((l) => l.listId === listId);
        return sum + (list?.entries?.length || 0);
      },
      0
    );
    if (settingsStore.preventSamePrize && prizeId) {
      const prize = dataStore.prizes.find((p) => p.prizeId === prizeId);
      const prizeName = prize?.name;
      if (prizeName && dataStore.winners.length > 0) {
        const samePrizeWinnerEntryIds = new Set(dataStore.winners.filter((w) => w.prize === prizeName).map((w) => w.entryId).filter(Boolean));
        if (samePrizeWinnerEntryIds.size > 0) {
          let eligible = 0;
          for (const listId of selectedIds) {
            const list = dataStore.lists.find((l) => l.listId === listId);
            if (list?.entries) {
              for (const entry of list.entries) {
                const entryId = entry.id || entry.data?.["Ticket Code"] || entry.data?.ticketCode;
                if (!entryId || !samePrizeWinnerEntryIds.has(entryId)) {
                  eligible++;
                }
              }
            }
          }
          total = eligible;
        }
      }
    }
    return total;
  }
  /**
   * Computed: Count of entries excluded due to same prize
   */
  get excludedCount() {
    const prizeId = this._selectedPrizeId.current;
    const selectedIds = this._selectedListIds.current;
    if (!settingsStore.preventSamePrize || !prizeId) {
      return 0;
    }
    const prize = dataStore.prizes.find((p) => p.prizeId === prizeId);
    const prizeName = prize?.name;
    if (!prizeName || dataStore.winners.length === 0) {
      return 0;
    }
    const samePrizeWinnerEntryIds = new Set(dataStore.winners.filter((w) => w.prize === prizeName).map((w) => w.entryId).filter(Boolean));
    let excluded = 0;
    for (const listId of selectedIds) {
      const list = dataStore.lists.find((l) => l.listId === listId);
      if (list?.entries) {
        for (const entry of list.entries) {
          const entryId = entry.id || entry.data?.["Ticket Code"] || entry.data?.ticketCode;
          if (entryId && samePrizeWinnerEntryIds.has(entryId)) {
            excluded++;
          }
        }
      }
    }
    return excluded;
  }
  /**
   * Computed: Can start selection (has list and prize selected)
   */
  get canStart() {
    return this._selectedListIds.current.length > 0 && !!this._selectedPrizeId.current;
  }
  /**
   * Computed: Display text for selected list(s)
   */
  get listDisplayText() {
    const selectedIds = this._selectedListIds.current;
    if (selectedIds.length === 0) return "Not Selected";
    if (selectedIds.length === 1) {
      const list = dataStore.lists.find((l) => l.listId === selectedIds[0]);
      return list?.metadata?.name || "Unknown";
    }
    return `${selectedIds.length} Lists Selected`;
  }
  /**
   * Computed: Display text for selected prize
   */
  get prizeDisplayText() {
    const prizeId = this._selectedPrizeId.current;
    if (!prizeId) return "Not Selected";
    const prize = dataStore.prizes.find((p) => p.prizeId === prizeId);
    return prize?.name || "Not Selected";
  }
  /**
   * Computed: Selected prize quantity
   */
  get selectedPrizeQuantity() {
    const prizeId = this._selectedPrizeId.current;
    if (!prizeId) return null;
    const prize = dataStore.prizes.find((p) => p.prizeId === prizeId);
    return prize?.quantity ?? null;
  }
  /**
   * Computed: Winners count exceeds eligible entries
   */
  get entriesExceeded() {
    if (this._selectedListIds.current.length === 0) return false;
    return this._winnersCount.current > this.eligibleEntries;
  }
  /**
   * Computed: Winners count exceeds prize quantity
   */
  get prizeQuantityExceeded() {
    const qty = this.selectedPrizeQuantity;
    if (qty === null) return false;
    return this._winnersCount.current > qty;
  }
  /**
   * Computed: Has any validation warning
   */
  get hasValidationWarning() {
    return this.entriesExceeded || this.prizeQuantityExceeded;
  }
  /**
   * Computed: Count of selected lists that are still valid
   */
  get validSelectedCount() {
    const validIds = dataStore.lists.map((l) => l.listId);
    return this._selectedListIds.current.filter((id) => validIds.includes(id)).length;
  }
  /**
   * Check if a list is selected
   */
  isListSelected(listId) {
    return this._selectedListIds.current.includes(listId);
  }
  /**
   * Toggle list selection
   */
  toggleList(listId) {
    const currentIds = this._selectedListIds.current;
    if (currentIds.includes(listId)) {
      this.selectedListIds = currentIds.filter((id) => id !== listId);
    } else {
      this.selectedListIds = [...currentIds, listId];
    }
  }
  /**
   * Select a list
   */
  selectList(listId) {
    if (!this._selectedListIds.current.includes(listId)) {
      this.selectedListIds = [...this._selectedListIds.current, listId];
    }
  }
  /**
   * Deselect a list
   */
  deselectList(listId) {
    if (this._selectedListIds.current.includes(listId)) {
      this.selectedListIds = this._selectedListIds.current.filter((id) => id !== listId);
    }
  }
  /**
   * Handle prize change - update winnersCount from prize default
   */
  onPrizeChange() {
    const prizeId = this._selectedPrizeId.current;
    if (prizeId) {
      const prize = dataStore.prizes.find((p) => p.prizeId === prizeId);
      if (prize?.winnersCount) {
        this.winnersCount = prize.winnersCount;
      }
    }
    this.capWinnersCount();
  }
  /**
   * Cap winnersCount to not exceed eligibleEntries or prizeQuantity
   */
  capWinnersCount() {
    const currentCount = this._winnersCount.current;
    if (this.eligibleEntries > 0 && currentCount > this.eligibleEntries) {
      this.winnersCount = this.eligibleEntries;
    }
    const prizeQty = this.selectedPrizeQuantity;
    if (prizeQty !== null && this._winnersCount.current > prizeQty) {
      this.winnersCount = prizeQty;
    }
  }
  /**
   * Clear all selections
   */
  clearSelections() {
    this._selectedListIds.reset();
    this._selectedPrizeId.reset();
    this._winnersCount.reset();
  }
}
const setupStore = new SetupStore();
class UIStore {
  // Persisted navigation state
  _view = persistedState("ui_view", "public");
  _currentTab = persistedState("ui_currentTab", "quicksetup");
  // Progress overlay state (NOT persisted - transient UI state)
  _showProgress = false;
  _progressTitle = "Processing...";
  _progressText = "Please wait...";
  _progressPercent = 0;
  // Getters/setters for persisted values
  get view() {
    return this._view.current;
  }
  set view(value) {
    this._view.current = value;
  }
  get currentTab() {
    return this._currentTab.current;
  }
  set currentTab(value) {
    this._currentTab.current = value;
  }
  // Getters/setters for transient progress state
  get showProgress() {
    return this._showProgress;
  }
  set showProgress(value) {
    this._showProgress = value;
  }
  get progressTitle() {
    return this._progressTitle;
  }
  set progressTitle(value) {
    this._progressTitle = value;
  }
  get progressText() {
    return this._progressText;
  }
  set progressText(value) {
    this._progressText = value;
  }
  get progressPercent() {
    return this._progressPercent;
  }
  set progressPercent(value) {
    this._progressPercent = value;
  }
  /**
   * Switch to management view
   */
  showManagement() {
    this.view = "management";
  }
  /**
   * Switch to public view and reset tab
   */
  showPublic() {
    this.view = "public";
    this.currentTab = "quicksetup";
  }
  /**
   * Set the current tab
   */
  setTab(tabId) {
    this.currentTab = tabId;
  }
  /**
   * Start progress overlay
   */
  startProgress(title, text = "Please wait...") {
    this.progressTitle = title;
    this.progressText = text;
    this.progressPercent = 0;
    this.showProgress = true;
  }
  /**
   * Update progress state
   */
  updateProgress(percent, text) {
    this.progressPercent = percent;
    if (text) {
      this.progressText = text;
    }
  }
  /**
   * End progress overlay
   */
  endProgress() {
    this.showProgress = false;
    this.progressPercent = 0;
  }
  /**
   * Utility to trigger a modal by clicking its button
   */
  openModal(buttonId) {
  }
  /**
   * Restore Bootstrap tab on management view
   */
  async restoreTab() {
    return;
  }
  /**
   * Reset navigation to defaults
   */
  resetNavigation() {
    this._view.reset();
    this._currentTab.reset();
  }
}
const uiStore = new UIStore();
function QuickSetup($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    function handlePrizeChange(e) {
      const target = e.currentTarget;
      setupStore.selectedPrizeId = target.value;
      setupStore.onPrizeChange();
    }
    $$renderer2.push(`<div class="card"><div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-gear-fill me-2"></i>Quick Selection Setup</h5></div> <div class="card-body"><p class="card-text text-muted mb-4">Configure the next public winner selection from here.</p> <div class="row g-3"><div class="col-md-5"><label class="form-label fw-semibold">Select Lists</label> <div class="list-selection-container"><div class="border rounded p-2" style="max-height: 200px; overflow-y: auto;">`);
    if (dataStore.lists.length === 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="text-muted mb-0">No lists uploaded yet</p>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(dataStore.lists);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let list = each_array[$$index];
        $$renderer2.push(`<div class="form-check"><input class="form-check-input" type="checkbox"${attr("id", `list-${stringify(list.listId)}`)}${attr("checked", setupStore.isListSelected(list.listId), true)}/> <label class="form-check-label"${attr("for", `list-${stringify(list.listId)}`)}>${escape_html(list.metadata.name)} <span class="text-muted">(${escape_html(list.entries?.length || 0)})</span></label></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> <div class="d-flex justify-content-between align-items-center mt-2"><div class="list-selection-controls"><button type="button" class="btn btn-sm btn-outline-primary">Select All</button> <button type="button" class="btn btn-sm btn-outline-secondary">Clear All</button> <span class="ms-2 text-muted">${escape_html(setupStore.validSelectedCount)} selected</span></div> <small class="text-muted">Eligible: ${escape_html(setupStore.eligibleEntries.toLocaleString())}${escape_html(setupStore.excludedCount > 0 ? ` (${setupStore.excludedCount} excluded)` : "")}</small></div></div></div> <div class="col-md-5"><label class="form-label fw-semibold">Select Prize</label> `);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: setupStore.selectedPrizeId,
        onchange: handlePrizeChange
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Select Prize...`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(dataStore.prizes);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let prize = each_array_1[$$index_1];
          $$renderer3.option({ value: prize.prizeId }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(prize.name)} (${escape_html(prize.quantity)} available)`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <div class="col-md-2"><label class="form-label fw-semibold">Number of Winners</label> <input type="number"${attr_class("form-control form-control-lg", void 0, {
      "border-danger": setupStore.hasValidationWarning,
      "text-danger": setupStore.hasValidationWarning
    })} min="1" max="9999" placeholder="Count"${attr("value", setupStore.winnersCount)}/> `);
    if (setupStore.entriesExceeded) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<small class="text-danger d-block mt-1">${escape_html(setupStore.eligibleEntries === 0 ? "No entries available" : `Only ${setupStore.eligibleEntries} entries available${setupStore.excludedCount > 0 ? ` (${setupStore.excludedCount} excluded)` : ""}`)}</small>`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (setupStore.prizeQuantityExceeded) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<small class="text-danger d-block mt-1">Only ${escape_html(setupStore.selectedPrizeQuantity)} prizes available</small>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div></div></div> <div class="row g-4 mt-3"><div class="col-lg-6"><div class="card h-100"><div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-eye-fill me-2"></i>Reveal Settings</h5></div> <div class="card-body"><div class="mb-3"><label class="form-label fw-semibold">Selection Mode</label> `);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: settingsStore.selectionMode,
        onchange: (e) => settingsStore.selectionMode = e.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "all-at-once" }, ($$renderer4) => {
          $$renderer4.push(`All at Once`);
        });
        $$renderer3.option({ value: "sequential" }, ($$renderer4) => {
          $$renderer4.push(`Sequential Reveal`);
        });
        $$renderer3.option({ value: "individual" }, ($$renderer4) => {
          $$renderer4.push(`Individual Selection`);
        });
      }
    );
    $$renderer2.push(`</div> <div class="mb-3"><label class="form-label fw-semibold">Display Effect</label> `);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: settingsStore.displayEffect,
        onchange: (e) => settingsStore.displayEffect = e.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "fade-in" }, ($$renderer4) => {
          $$renderer4.push(`Fade In`);
        });
        $$renderer3.option({ value: "fly-in" }, ($$renderer4) => {
          $$renderer4.push(`Fly In`);
        });
        $$renderer3.option({ value: "zoom-in" }, ($$renderer4) => {
          $$renderer4.push(`Zoom In`);
        });
        $$renderer3.option({ value: "slide-in" }, ($$renderer4) => {
          $$renderer4.push(`Slide In`);
        });
        $$renderer3.option({ value: "bounce-in" }, ($$renderer4) => {
          $$renderer4.push(`Bounce In`);
        });
      }
    );
    $$renderer2.push(`</div> <div class="mb-3"><label class="form-label fw-semibold">Time Between Winners (seconds)</label> <input type="number" class="form-control form-control-lg" min="0.1" max="5" step="0.1"${attr("value", settingsStore.displayDuration)}/></div> `);
    if (settingsStore.selectionMode === "sequential" || settingsStore.selectionMode === "individual") {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="mb-3"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="stableGrid"${attr("checked", settingsStore.stableGrid, true)}/> <label class="form-check-label fw-semibold" for="stableGrid">Stable Grid <i class="bi bi-info-circle text-muted ms-1" title="Pre-position all cards to prevent grid shifting during reveal"></i></label></div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></div></div> <div class="col-lg-6"><div class="card h-100"><div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-clock-fill me-2"></i>Delay Settings</h5></div> <div class="card-body"><div class="mb-3"><label class="form-label fw-semibold">Delay Duration (seconds)</label> <input type="number" class="form-control form-control-lg" min="0" max="30" step="0.5"${attr("value", settingsStore.preSelectionDelay)}/></div> <div class="mb-3"><label class="form-label fw-semibold">Delay Visual</label> `);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: settingsStore.delayVisualType,
        onchange: (e) => settingsStore.delayVisualType = e.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`No Visual (Silent)`);
        });
        $$renderer3.option({ value: "countdown" }, ($$renderer4) => {
          $$renderer4.push(`Countdown Timer`);
        });
        $$renderer3.option({ value: "animation" }, ($$renderer4) => {
          $$renderer4.push(`Particle Animation`);
        });
        $$renderer3.option({ value: "swirl-animation" }, ($$renderer4) => {
          $$renderer4.push(`Swirl Animation`);
        });
        $$renderer3.option({ value: "christmas-snow" }, ($$renderer4) => {
          $$renderer4.push(`Christmas Snow`);
        });
        $$renderer3.option({ value: "time-machine" }, ($$renderer4) => {
          $$renderer4.push(`Time Machine`);
        });
      }
    );
    $$renderer2.push(`</div> <div><button type="button" class="btn btn-outline-info"><i class="bi bi-eye me-1"></i>Preview Delay</button></div></div></div></div></div> <div class="row g-4 mt-3"><div class="col-lg-6"><div class="card h-100"><div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-star-fill me-2"></i>Celebration Effects</h5></div> <div class="card-body"><div class="mb-3"><label class="form-label fw-semibold">Celebration Animation</label> `);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: settingsStore.celebrationEffect,
        onchange: (e) => settingsStore.celebrationEffect = e.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`No Animation`);
        });
        $$renderer3.option({ value: "confetti" }, ($$renderer4) => {
          $$renderer4.push(`Confetti`);
        });
        $$renderer3.option({ value: "coins" }, ($$renderer4) => {
          $$renderer4.push(`Gold Coins`);
        });
        $$renderer3.option({ value: "both" }, ($$renderer4) => {
          $$renderer4.push(`Both Confetti &amp; Coins`);
        });
      }
    );
    $$renderer2.push(`</div> <div class="mb-3"><label class="form-label fw-semibold">Animation Duration (seconds)</label> <input type="number" class="form-control form-control-lg" min="1" max="10" step="0.5"${attr("value", settingsStore.celebrationDuration)}/></div> <div class="mb-3"><div class="form-check"><input class="form-check-input" type="checkbox" id="celebrationAutoTrigger"${attr("checked", settingsStore.celebrationAutoTrigger, true)}/> <label class="form-check-label" for="celebrationAutoTrigger">Auto-trigger celebration when winners are revealed</label></div></div> <div><button type="button" class="btn btn-sm btn-outline-secondary"><i class="bi bi-play-fill me-1"></i>Test Celebration</button></div></div></div></div> <div class="col-lg-6"><div class="card h-100"><div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-volume-up-fill me-2"></i>Sound Settings</h5></div> <div class="card-body"><div class="mb-3"><label class="form-label fw-semibold">Sound During Delay</label> <div class="input-group">`);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: settingsStore.soundDuringDelay,
        onchange: (e) => settingsStore.soundDuringDelay = e.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`No Sound`);
        });
        $$renderer3.option({ value: "drumroll" }, ($$renderer4) => {
          $$renderer4.push(`Drumroll`);
        });
        $$renderer3.option({ value: "suspense" }, ($$renderer4) => {
          $$renderer4.push(`Suspense`);
        });
        $$renderer3.option({ value: "ticking" }, ($$renderer4) => {
          $$renderer4.push(`Ticking`);
        });
      }
    );
    $$renderer2.push(` <button type="button" class="btn btn-outline-secondary"><i class="bi bi-play-fill"></i> Test</button></div></div> <div class="mb-3"><label class="form-label fw-semibold">Sound at End of Delay</label> <div class="input-group">`);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: settingsStore.soundEndOfDelay,
        onchange: (e) => settingsStore.soundEndOfDelay = e.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`No Sound`);
        });
        $$renderer3.option({ value: "ding" }, ($$renderer4) => {
          $$renderer4.push(`Ding`);
        });
        $$renderer3.option({ value: "bell" }, ($$renderer4) => {
          $$renderer4.push(`Bell`);
        });
        $$renderer3.option({ value: "gong" }, ($$renderer4) => {
          $$renderer4.push(`Gong`);
        });
      }
    );
    $$renderer2.push(` <button type="button" class="btn btn-outline-secondary"><i class="bi bi-play-fill"></i> Test</button></div></div> <div class="mb-3"><label class="form-label fw-semibold">Sound During Reveal</label> <div class="input-group">`);
    $$renderer2.select(
      {
        class: "form-select form-select-lg",
        value: settingsStore.soundDuringReveal,
        onchange: (e) => settingsStore.soundDuringReveal = e.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`No Sound`);
        });
        $$renderer3.option({ value: "fanfare" }, ($$renderer4) => {
          $$renderer4.push(`Fanfare`);
        });
        $$renderer3.option({ value: "applause" }, ($$renderer4) => {
          $$renderer4.push(`Applause`);
        });
        $$renderer3.option({ value: "celebration" }, ($$renderer4) => {
          $$renderer4.push(`Celebration`);
        });
      }
    );
    $$renderer2.push(` <button type="button" class="btn btn-outline-secondary"><i class="bi bi-play-fill"></i> Test</button></div></div></div></div></div></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    if (uiStore.view === "public") {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="public-selection-interface"><header class="selection-header"><div class="d-flex align-items-center gap-2"><h1 class="h5 mb-0 text-white">Winner Selection</h1></div> <button class="btn btn-light btn-sm"><i class="bi bi-gear"></i> <span class="d-none d-sm-inline ms-1">Manage</span></button></header> <main class="selection-main"><div class="selection-controls"><h2 class="selection-title">Select Winners</h2> <p class="selection-subtitle">Choose a list and prize to begin</p> <div class="selection-info"><div class="info-card"><div class="info-label">Current List</div> <div class="info-value">${escape_html(setupStore.listDisplayText)}</div></div> <div class="info-card"><div class="info-label">Eligible Entries</div> <div class="info-value">${escape_html(setupStore.eligibleEntries)}</div></div> <div class="info-card"><div class="info-label">Winners to Select</div> <div class="info-value">${escape_html(setupStore.winnersCount)}</div></div> <div class="info-card"><div class="info-label">Prize</div> <div class="info-value">${escape_html(setupStore.prizeDisplayText)}</div></div></div> <button class="big-play-button"${attr("disabled", !setupStore.canStart, true)} aria-label="Start winner selection"><i class="bi bi-play-fill"></i></button> `);
      if (setupStore.hasValidationWarning) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="alert alert-warning mt-3">`);
        if (setupStore.entriesExceeded) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<i class="bi bi-exclamation-triangle"></i> Winners count exceeds available entries`);
        } else {
          $$renderer2.push("<!--[!-->");
          if (setupStore.prizeQuantityExceeded) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<i class="bi bi-exclamation-triangle"></i> Winners count exceeds prize quantity`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div></main></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div class="management-interface"><header class="management-header bg-primary text-white p-3 svelte-1uha8ag"><div class="container-fluid d-flex justify-content-between align-items-center"><h1 class="h5 mb-0">Winner Selection - Management</h1> <button class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <span class="ms-1">Back to Selection</span></button></div></header> <div class="container-fluid py-4"><ul class="nav nav-tabs mb-4" role="tablist"><li class="nav-item"><button${attr_class("nav-link svelte-1uha8ag", void 0, { "active": uiStore.currentTab === "quicksetup" })}><i class="bi bi-lightning"></i> <span class="d-none d-md-inline ms-1">Quick Setup</span></button></li> <li class="nav-item"><button${attr_class("nav-link svelte-1uha8ag", void 0, { "active": uiStore.currentTab === "lists" })}><i class="bi bi-list-ul"></i> <span class="d-none d-md-inline ms-1">Lists</span> <span class="badge bg-secondary ms-1">${escape_html(dataStore.lists.length)}</span></button></li> <li class="nav-item"><button${attr_class("nav-link svelte-1uha8ag", void 0, { "active": uiStore.currentTab === "prizes" })}><i class="bi bi-trophy"></i> <span class="d-none d-md-inline ms-1">Prizes</span> <span class="badge bg-secondary ms-1">${escape_html(dataStore.prizes.length)}</span></button></li> <li class="nav-item"><button${attr_class("nav-link svelte-1uha8ag", void 0, { "active": uiStore.currentTab === "winners" })}><i class="bi bi-people"></i> <span class="d-none d-md-inline ms-1">Winners</span> <span class="badge bg-secondary ms-1">${escape_html(dataStore.winners.length)}</span></button></li> <li class="nav-item"><button${attr_class("nav-link svelte-1uha8ag", void 0, { "active": uiStore.currentTab === "history" })}><i class="bi bi-clock-history"></i> <span class="d-none d-md-inline ms-1">History</span></button></li> <li class="nav-item"><button${attr_class("nav-link svelte-1uha8ag", void 0, { "active": uiStore.currentTab === "settings" })}><i class="bi bi-gear"></i> <span class="d-none d-md-inline ms-1">Settings</span></button></li></ul> <div class="tab-content">`);
      if (uiStore.currentTab === "quicksetup") {
        $$renderer2.push("<!--[-->");
        QuickSetup($$renderer2);
      } else {
        $$renderer2.push("<!--[!-->");
        if (uiStore.currentTab === "lists") {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><h5 class="card-title">Lists</h5> <button class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add List</button></div> <div class="card-body">`);
          if (dataStore.loading.lists) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
            if (dataStore.lists.length === 0) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<p class="text-muted text-center py-4">No lists yet. Upload a CSV to get started.</p>`);
            } else {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push(`<div class="row g-3"><!--[-->`);
              const each_array = ensure_array_like(dataStore.lists);
              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                let list = each_array[$$index];
                $$renderer2.push(`<div class="col-md-4 col-lg-3"><div class="card h-100"><div class="card-body"><h6 class="card-title">${escape_html(list.metadata.name)}</h6> <p class="text-muted small mb-0">${escape_html(list.entries?.length || 0)} entries</p></div></div></div>`);
              }
              $$renderer2.push(`<!--]--></div>`);
            }
            $$renderer2.push(`<!--]-->`);
          }
          $$renderer2.push(`<!--]--></div></div>`);
        } else {
          $$renderer2.push("<!--[!-->");
          if (uiStore.currentTab === "prizes") {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><h5 class="card-title">Prizes</h5> <button class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add Prize</button></div> <div class="card-body">`);
            if (dataStore.loading.prizes) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`);
            } else {
              $$renderer2.push("<!--[!-->");
              if (dataStore.prizes.length === 0) {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<p class="text-muted text-center py-4">No prizes yet. Add a prize to get started.</p>`);
              } else {
                $$renderer2.push("<!--[!-->");
                $$renderer2.push(`<div class="row g-3"><!--[-->`);
                const each_array_1 = ensure_array_like(dataStore.prizes);
                for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                  let prize = each_array_1[$$index_1];
                  $$renderer2.push(`<div class="col-md-4 col-lg-3"><div class="card h-100"><div class="card-body"><h6 class="card-title">${escape_html(prize.name)}</h6> <span class="badge bg-primary">${escape_html(prize.quantity)} remaining</span> `);
                  if (prize.description) {
                    $$renderer2.push("<!--[-->");
                    $$renderer2.push(`<p class="text-muted small mt-2 mb-0">${escape_html(prize.description)}</p>`);
                  } else {
                    $$renderer2.push("<!--[!-->");
                  }
                  $$renderer2.push(`<!--]--></div></div></div>`);
                }
                $$renderer2.push(`<!--]--></div>`);
              }
              $$renderer2.push(`<!--]-->`);
            }
            $$renderer2.push(`<!--]--></div></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
            if (uiStore.currentTab === "winners") {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<div class="card"><div class="card-header"><h5 class="card-title">Winners</h5></div> <div class="card-body">`);
              if (dataStore.loading.winners) {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`);
              } else {
                $$renderer2.push("<!--[!-->");
                if (dataStore.winners.length === 0) {
                  $$renderer2.push("<!--[-->");
                  $$renderer2.push(`<p class="text-muted text-center py-4">No winners yet. Run a selection to get started.</p>`);
                } else {
                  $$renderer2.push("<!--[!-->");
                  $$renderer2.push(`<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Name</th><th>Prize</th><th>List</th><th>Date</th><th>Status</th></tr></thead><tbody><!--[-->`);
                  const each_array_2 = ensure_array_like(dataStore.winners);
                  for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
                    let winner = each_array_2[$$index_2];
                    $$renderer2.push(`<tr><td>${escape_html(winner.displayName)}</td><td>${escape_html(winner.prize)}</td><td>${escape_html(winner.listName)}</td><td>${escape_html(new Date(winner.timestamp).toLocaleDateString())}</td><td>`);
                    if (winner.pickedUp) {
                      $$renderer2.push("<!--[-->");
                      $$renderer2.push(`<span class="badge bg-success">Picked Up</span>`);
                    } else {
                      $$renderer2.push("<!--[!-->");
                      $$renderer2.push(`<span class="badge bg-warning">Pending</span>`);
                    }
                    $$renderer2.push(`<!--]--></td></tr>`);
                  }
                  $$renderer2.push(`<!--]--></tbody></table></div>`);
                }
                $$renderer2.push(`<!--]-->`);
              }
              $$renderer2.push(`<!--]--></div></div>`);
            } else {
              $$renderer2.push("<!--[!-->");
              if (uiStore.currentTab === "history") {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<div class="card"><div class="card-header"><h5 class="card-title">Selection History</h5></div> <div class="card-body">`);
                if (dataStore.history.length === 0) {
                  $$renderer2.push("<!--[-->");
                  $$renderer2.push(`<p class="text-muted text-center py-4">No selection history yet.</p>`);
                } else {
                  $$renderer2.push("<!--[!-->");
                  $$renderer2.push(`<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Date</th><th>List</th><th>Prize</th><th>Winners</th></tr></thead><tbody><!--[-->`);
                  const each_array_3 = ensure_array_like(dataStore.history);
                  for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
                    let entry = each_array_3[$$index_3];
                    $$renderer2.push(`<tr><td>${escape_html(new Date(entry.timestamp).toLocaleString())}</td><td>${escape_html(entry.listName)}</td><td>${escape_html(entry.prizeName)}</td><td>${escape_html(entry.winnersCount)}</td></tr>`);
                  }
                  $$renderer2.push(`<!--]--></tbody></table></div>`);
                }
                $$renderer2.push(`<!--]--></div></div>`);
              } else {
                $$renderer2.push("<!--[!-->");
                if (uiStore.currentTab === "settings") {
                  $$renderer2.push("<!--[-->");
                  $$renderer2.push(`<div class="card"><div class="card-header"><h5 class="card-title">Settings</h5></div> <div class="card-body"><div class="row g-4"><div class="col-md-6"><h6>General</h6> <div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="preventDuplicates"${attr("checked", settingsStore.preventDuplicates, true)}/> <label class="form-check-label" for="preventDuplicates">Prevent duplicate winners</label></div> <div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="preventSamePrize"${attr("checked", settingsStore.preventSamePrize, true)}/> <label class="form-check-label" for="preventSamePrize">Prevent same person winning same prize twice</label></div></div> <div class="col-md-6"><h6>Theme</h6> <div class="mb-3"><label class="form-label" for="primaryColor">Primary Color</label> <input type="color" class="form-control form-control-color" id="primaryColor"${attr("value", settingsStore.primaryColor)}/></div> <div class="mb-3"><label class="form-label" for="secondaryColor">Secondary Color</label> <input type="color" class="form-control form-control-color" id="secondaryColor"${attr("value", settingsStore.secondaryColor)}/></div></div></div></div></div>`);
                } else {
                  $$renderer2.push("<!--[!-->");
                }
                $$renderer2.push(`<!--]-->`);
              }
              $$renderer2.push(`<!--]-->`);
            }
            $$renderer2.push(`<!--]-->`);
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div></div></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
