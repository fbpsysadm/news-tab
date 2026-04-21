import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  const hiddenDiscoveryElements = new Map();
  const discoverySelectorsToHide = [
    ".topic-list-container",
    ".list-container .topic-list",
    ".top-lists",
    ".list-controls .top-lists",
    ".period-chooser",
    ".list-controls .select-kit.period-chooser",
    ".list-controls .combo-box.period-chooser",
    ".categories-and-latest .category-list",
    ".categories-and-latest .latest-topic-list",
    ".categories-and-latest .categories-list",
    ".category-list",
    ".category-boxes",
    ".latest-topic-list",
  ];

  let newsLoaded = false;
  let newsLoading = false;
  let newsFetchPromise = null;
  let activeCustomTab = null;
  let newsItems = [];
  let visibleNewsItems = [];
  let newsError = null;
  let fetchTime = null;

  function isDiscoveryPage() {
    return /^\/(latest|new|unread|top|categories)?(?:\?.*)?$/.test(window.location.pathname + window.location.search);
  }


  function getNavList() {
    return (
      document.querySelector(".navigation-container .nav-pills") ||
      document.querySelector(".list-controls .nav-pills") ||
      document.querySelector(".discovery-navigation .nav-pills")
    );
  }

  function getTabContainer(tabClassName) {
    let container = document.querySelector(`.${tabClassName}`);
    if (container) {
      return container;
    }

    const target =
      document.querySelector(".list-container") ||
      document.querySelector(".topic-list-container") ||
      document.querySelector(".discovery-list-container") ||
      document.querySelector("#main-outlet");

    if (!target) {
      return null;
    }

    container = document.createElement("section");
    container.className = tabClassName;
    container.style.display = "none";
    target.prepend(container);
    return container;
  }

  function getNewsContainer() {
    return getTabContainer("news-tab");
  }

  function getGamesContainer() {
    return getTabContainer("games-tab");
  }

  function setGamesCursorOverride(enabled) {
    const targets = [
      document.body,
      document.documentElement,
      document.querySelector("#main-outlet"),
      document.querySelector(".list-container"),
      document.querySelector(".discovery-list-container"),
    ];

    targets.forEach((element) => {
      if (!element) {
        return;
      }

      if (enabled) {
        element.style.setProperty("cursor", "default", "important");
      } else {
        element.style.removeProperty("cursor");
      }
    });
  }

  function formatFetchTime(value) {
    if (!value) {
      return "Unknown";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    const diffMs = Date.now() - parsed.getTime();
    if (diffMs <= 0) {
      return "just now";
    }

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function renderNews(container) {
    if (!container) {
      return;
    }

    if (newsError) {
      container.innerHTML = `<div class="news-error">${newsError}</div>`;
      return;
    }

    if (!newsItems.length) {
      container.innerHTML = '<div class="news-empty">No news available.</div>';
      return;
    }

    const filteredNewsItems = newsItems //.filter((item) => item?.publisher !== "半岛");

    if (!filteredNewsItems.length) {
      container.innerHTML = '<div class="news-empty">No news available.</div>';
      return;
    }

    visibleNewsItems = filteredNewsItems;

    const createTopicIcon = `<svg class="fa d-icon d-icon-d-chat svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#comment"></use></svg>`;

    const copyIcon = `<svg class="fa d-icon d-icon-d-copy svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#copy"></use></svg>`;

    const items = filteredNewsItems
      .map((item, index) => {
        // get its fields for a news item
        const title = item.title || "Untitled";
        const publisher = item.publisher || "Unknown";
        const url = item.url || "#";
        const descriptionText = item.description || "";
        const pub_date = item.pub_date ? new Date(item.pub_date).toLocaleString() : "";

        // for creating a topic for the news
        const topicBody = `\n\n>${descriptionText}${descriptionText ? "\n\n" : ""}\n${url}`;
        const createTopicUrl = `https://www.freeblueplanet.com/new-topic?title=${encodeURIComponent(title)}&body=${encodeURIComponent(topicBody)}`;
        // target="_blank"  // this open a new windows, but slower.
        const createTopicLink = `<span class="news-create-topic"><a href="${createTopicUrl}" rel="noopener noreferrer" title="发帖聊天">${createTopicIcon}</a></span>`;
        const copyButton = `<span class="news-copy-button" type="button" data-index="${index}" title="复制到剪贴板">${copyIcon}</span>`;

        // meta is the subtitle line, description is the news summary
        const meta = `<div class="news-meta">${publisher}${pub_date ? ` • ${pub_date}` : ""} &nbsp; ${createTopicLink} &nbsp; ${copyButton}</div>`;
        const description = descriptionText ? `<p class="news-summary">${descriptionText}</p>` : "";
        return `<li class="news-item"><hr><div class="news-title"><a href="${url}" target="_blank">${title}</a></div>${meta}${description}</li>`;
      })
      .join("");

    const fetchTimeLabel = formatFetchTime(fetchTime);
    const itemCountLabel = `${filteredNewsItems.length}`;
    const refreshLink = '<a href="#" class="news-refresh" data-action="refresh-news">refresh</a>';
    const header = `<div class="news-header">${itemCountLabel} fetched ${fetchTimeLabel} &nbsp; ${refreshLink}</div>`;    

    container.innerHTML = `${header}<ul class="news-list">${items}</ul>`;
  }

  function renderGames(container) {
    if (!container) {
      return;
    }

    container.style.cursor = "default";

    container.innerHTML = `
      <div class="games-panel">
        <iframe class="games-iframe" allowfullscreen="true" scrolling="no" width="100%" height="400"
          src="https://www.spiele-umsonst.de/azad/downloads/html5games/skill/bubbleshooterclassic/" frameborder="0"></iframe>
      </div>
    `;
  }

  function formatNewsItemText(item) {
    const title = item?.title || "Untitled";
    // const publisher = item?.publisher || "Unknown";
    // const pub_date = item?.pub_date ? new Date(item.pub_date).toLocaleString() : "";
    const descriptionText = item?.description || "";
    const url = item?.url || "";
    // const meta = `${publisher}${pub_date ? ` • ${pub_date}` : ""}`;

    // const parts = [title, meta];
    // if (descriptionText) {
    //   parts.push(descriptionText);
    // }
    // if (url) {
    //   parts.push(url);
    // }
    // return parts.join("\n");

    const ret = ">" + title + "\n>" + descriptionText + "\n\n" + url
    return ret
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        resolve();
      } else {
        reject(new Error("Copy failed"));
      }
    });
  }

  function ensureCopyHandler(container) {
    if (!container || container.dataset.copyHandlerBound === "true") {
      return;
    }

    container.dataset.copyHandlerBound = "true";
    container.addEventListener("click", (event) => {
      const button = event.target.closest(".news-copy-button");
      if (!button) {
        return;
      }

      event.preventDefault();

      const index = Number(button.dataset.index);
      const item = visibleNewsItems[index];
      if (!item) {
        return;
      }

      const text = formatNewsItemText(item);
      copyTextToClipboard(text)
        .then(() => {
          button.classList.add("is-copied");
          const original = button.textContent;
          button.textContent = "已复制";
          setTimeout(() => {
            button.textContent = original;
            button.classList.remove("is-copied");
          }, 1500);
        })
        .catch(() => {
          button.classList.add("is-copy-failed");
          setTimeout(() => button.classList.remove("is-copy-failed"), 1500);
        });
    });
  }

  function ensureRefreshHandler(container) {
    if (!container || container.dataset.refreshHandlerBound === "true") {
      return;
    }

    container.dataset.refreshHandlerBound = "true";
    container.addEventListener("click", (event) => {
      const refreshLink = event.target.closest(".news-refresh");
      if (!refreshLink) {
        return;
      }

      event.preventDefault();
      fetchNews(container, { force: true });
    });
  }


  // {
  //   "success": true,
  //   "data": {
  //     "news": [
  //       {
  //         "title": "乌克兰被俘朝鲜士兵想去韩国 首尔态度迟疑",
  //         "publisher": "德国之声",
  //         "url": "https://www.dw.com/zh/乌克兰被俘朝鲜士兵想去韩国-首尔态度迟疑/a-76094690",
  //         "pub_date": "2026-02-23T15:19:00Z",
  //         "description": "两名在乌克兰被俘的朝鲜士兵表示希望前往韩国，而不是返回朝鲜面对可能的严厉惩罚。相关人士指出，朝鲜政权甚至可能选择惩罚其家属。人权人士批评首尔在接收问题上行动迟缓。"
  //       },
  //       ...    
  //     ],
  // }  


  function fetchNews(container, { force = false } = {}) {
    if (force) {
      newsLoaded = false;
      newsError = null;
    }

    if (newsLoaded) {
      if (container) {
        renderNews(container);
      }
      return Promise.resolve();
    }

    if (container && !newsLoading) {
      container.innerHTML = '<div class="news-empty">Fetching latest news from several sources... it may take several seconds.</div>';
    }

    if (newsLoading && newsFetchPromise) {
      if (container) {
        container.innerHTML = '<div class="news-empty">Fetching latest news from several sources... it may take several seconds.</div>';
      }

      return newsFetchPromise.then(() => {
        if (container) {
          renderNews(container);
        }
      });
    }

    newsLoading = true;
    const apiUrl = settings?.api_url?.trim() || "https://formatjsononline.com/api/products";

    newsFetchPromise = fetch(apiUrl)
      .then((response) => response.json())
      .then((data) => {
        fetchTime = data?.fetchTime || new Date().toGMTString();
        newsItems = Array.isArray(data?.data?.news) ? data.data.news : [];
        newsError = newsItems.length ? null : "No news found in data.news.";
        newsLoaded = true;
      })
      .catch(() => {
        newsItems = [];
        newsError = "Failed to load news.";
        newsLoaded = true;
      })
      .finally(() => {
        newsLoading = false;
      });

    return newsFetchPromise.then(() => {
      if (container) {
        renderNews(container);
      }
    });
  }

  /**
   * Preloads news data in the background if certain conditions are met:
   * - News has not been loaded or is not currently loading.
   * - The user is on the discovery page.
   * Uses `requestIdleCallback` if available, otherwise falls back to `setTimeout`.
   */
  function preloadNewsInBackground() {
    // Don't preload if news is already loaded, currently loading, or user is not on discovery page,
    if (newsLoaded || newsLoading || !isDiscoveryPage()) {
      return;
    }

    const runPreload = () => fetchNews();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runPreload, { timeout: 1500 });
    } else {
      setTimeout(runPreload, 0);
    }
  }

  function showNewsTab() {
    const container = getNewsContainer();
    if (!container) {
      return;
    }

    setGamesCursorOverride(false);

    ensureCopyHandler(container);
    ensureRefreshHandler(container);

    activeCustomTab = "news";

    const gamesContainer = document.querySelector(".games-tab");
    if (gamesContainer) {
      gamesContainer.style.display = "none";
    }

    container.style.display = "block";

    discoverySelectorsToHide.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element || element.closest(".news-tab") || element.contains(container)) {
          return;
        }

        if (!hiddenDiscoveryElements.has(element)) {
          hiddenDiscoveryElements.set(element, element.style.display || "");
        }

        element.style.display = "none";
      });
    });

    fetchNews(container);
  }

  function showGamesTab() {
    const container = getGamesContainer();
    if (!container) {
      return;
    }

    activeCustomTab = "games";

    const newsContainer = document.querySelector(".news-tab");
    if (newsContainer) {
      newsContainer.style.display = "none";
    }

    container.style.display = "block";
    container.style.cursor = "default";
    setGamesCursorOverride(true);

    discoverySelectorsToHide.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element || element.closest(".games-tab") || element.contains(container)) {
          return;
        }

        if (!hiddenDiscoveryElements.has(element)) {
          hiddenDiscoveryElements.set(element, element.style.display || "");
        }

        element.style.display = "none";
      });
    });

    renderGames(container);
  }

  function hideNewsTab() {
    setGamesCursorOverride(false);

    const container = document.querySelector(".news-tab");
    if (container) {
      container.style.display = "none";
    }

    const gamesContainer = document.querySelector(".games-tab");
    if (gamesContainer) {
      gamesContainer.style.display = "none";
    }

    activeCustomTab = null;

    hiddenDiscoveryElements.forEach((previousDisplay, element) => {
      if (!element.isConnected) {
        return;
      }

      element.style.display = previousDisplay;
    });

    hiddenDiscoveryElements.clear();
  }

  function activateTab(navList, tabItem, link) {
    navList.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
    navList.querySelectorAll("a").forEach((a) => a.classList.remove("active"));
    tabItem.classList.add("active");
    link.classList.add("active");
  }

  function deactivateTab(navList, tabItem, link) {
    tabItem.classList.remove("active");
    link.classList.remove("active");

    const hasOtherActive = navList.querySelector("li.active, a.active");
    if (!hasOtherActive) {
      const latestLink = navList.querySelector('a[href*="/latest"]');
      if (latestLink) {
        latestLink.classList.add("active");
        latestLink.closest("li")?.classList.add("active");
      }
    }
  }

  function syncNewsTabState() {
    const navList = getNavList();
    const newsItem = navList?.querySelector(".nav-item-news");
    const link = newsItem?.querySelector('a[href="#news"]');
    const gamesItem = navList?.querySelector(".nav-item-games");
    const gamesLink = gamesItem?.querySelector('a[href="#games"]');

    if (!navList) {
      return;
    }

    if (activeCustomTab === "news" && newsItem && link) {
      activateTab(navList, newsItem, link);
      if (gamesItem && gamesLink) {
        deactivateTab(navList, gamesItem, gamesLink);
      }
      return;
    }

    if (activeCustomTab === "games" && gamesItem && gamesLink) {
      activateTab(navList, gamesItem, gamesLink);
      if (newsItem && link) {
        deactivateTab(navList, newsItem, link);
      }
      return;
    }

    if (newsItem && link) {
      deactivateTab(navList, newsItem, link);
    }

    if (gamesItem && gamesLink) {
      deactivateTab(navList, gamesItem, gamesLink);
    }
  }

  function resetNewsMode() {
    hideNewsTab();
    syncNewsTabState();
  }

  function injectNewsTab() {
    if (!isDiscoveryPage()) {
      return;
    }

    const navList = getNavList();
    if (!navList) {
      return;
    }

    const templateNavLink = navList.querySelector("a");
    if (!navList.querySelector(".nav-item-news")) {
      const newsItem = document.createElement("li");
      newsItem.className = "nav-item-news";

      const link = document.createElement("a");
      link.href = "#news";
      link.textContent = "新闻";

      if (templateNavLink) {
        link.className = Array.from(templateNavLink.classList)
          .filter((className) => className !== "active")
          .join(" ");
      }

      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateTab(navList, newsItem, link);
        showNewsTab();
      });

      newsItem.appendChild(link);

      const categoriesTab = Array.from(navList.querySelectorAll("li")).find((li) =>
        li.querySelector('a[href*="/categories"]')
      );

      if (categoriesTab?.parentNode) {
        categoriesTab.parentNode.insertBefore(newsItem, categoriesTab.nextSibling);
      } else {
        navList.appendChild(newsItem);
      }
    }

    if (!navList.querySelector(".nav-item-games")) {
      const gamesItem = document.createElement("li");
      gamesItem.className = "nav-item-games";

      const gamesLink = document.createElement("a");
      gamesLink.href = "#games";
      gamesLink.textContent = "游戏";

      if (templateNavLink) {
        gamesLink.className = Array.from(templateNavLink.classList)
          .filter((className) => className !== "active")
          .join(" ");
      }

      gamesLink.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateTab(navList, gamesItem, gamesLink);
        showGamesTab();
      });

      gamesItem.appendChild(gamesLink);

      const newsTab = navList.querySelector(".nav-item-news");
      if (newsTab?.parentNode) {
        newsTab.parentNode.insertBefore(gamesItem, newsTab.nextSibling);
      } else {
        navList.appendChild(gamesItem);
      }
    }

    if (!navList.dataset.newsTabListenerBound) {
      navList.dataset.newsTabListenerBound = "true";
      navList.addEventListener("click", (event) => {
        const targetLink = event.target.closest("a");
        const href = targetLink?.getAttribute("href");
        if (!targetLink || href === "#news" || href === "#games") {
          return;
        }

        hideNewsTab();

        const currentNewsItem = navList.querySelector(".nav-item-news");
        const currentNewsLink = currentNewsItem?.querySelector('a[href="#news"]');
        if (currentNewsItem && currentNewsLink) {
          deactivateTab(navList, currentNewsItem, currentNewsLink);
        }

        const currentGamesItem = navList.querySelector(".nav-item-games");
        const currentGamesLink = currentGamesItem?.querySelector('a[href="#games"]');
        if (currentGamesItem && currentGamesLink) {
          deactivateTab(navList, currentGamesItem, currentGamesLink);
        }
      });
    }
  }

  api.onPageChange(() => {
    resetNewsMode();
    setTimeout(() => {
      injectNewsTab();
      syncNewsTabState();
    }, 0);
    preloadNewsInBackground();
  });

  window.addEventListener("resize", () => {
    injectNewsTab();
  });
});
