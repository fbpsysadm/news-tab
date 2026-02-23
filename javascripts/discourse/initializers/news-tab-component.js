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
  let newsItems = [];
  let newsError = null;

  function isDiscoveryPage() {
    return /^\/(latest|new|unread|top|categories)?(?:\?.*)?$/.test(window.location.pathname + window.location.search);
  }

  function isDesktopBrowser() {
    const body = document.body;
    const isMobileClass = body?.classList.contains("mobile-view") || body?.classList.contains("mobile-device");
    const isSmallViewport = window.matchMedia("(max-width: 767px)").matches;
    return !isMobileClass && !isSmallViewport;
  }

  function getNavList() {
    return (
      document.querySelector(".navigation-container .nav-pills") ||
      document.querySelector(".list-controls .nav-pills") ||
      document.querySelector(".discovery-navigation .nav-pills")
    );
  }

  function getNewsContainer() {
    let container = document.querySelector(".news-tab");
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
    container.className = "news-tab";
    container.style.display = "none";
    target.prepend(container);
    return container;
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

    // fileter out news items from "半岛" publisher
    const filteredNewsItems = newsItems.filter((item) => item?.publisher !== "半岛");

    if (!filteredNewsItems.length) {
      container.innerHTML = '<div class="news-empty">No news available.</div>';
      return;
    }

    const createTopicIcon = `<svg class="fa d-icon d-icon-d-chat svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#comment"></use></svg>`;

    const items = filteredNewsItems
      .map((item) => {
        // get its fields for a news item
        const title = item.title || "Untitled";
        const publisher = item.publisher || "Unknown";
        const url = item.url || "#";
        const descriptionText = item.description || "";
        const pub_date = item.pub_date ? new Date(item.pub_date).toLocaleString() : "";

        // for creating a topic for the news
        const topicBody = `\n\n>${descriptionText}${descriptionText ? "\n\n" : ""}${url}`;
        const createTopicUrl = `https://www.freeblueplanet.com/new-topic?title=${encodeURIComponent(title)}&body=${encodeURIComponent(topicBody)}`;
        // target="_blank"  // this open a new windows, but slower.
        const createTopicLink = `<span class="news-create-topic"><a href="${createTopicUrl}" rel="noopener noreferrer">${createTopicIcon}</a></div>`;

        // meta is the subtitle line, description is the news summary
        const meta = `<div class="news-meta">${publisher}${pub_date ? ` • ${pub_date}` : ""}  ${createTopicLink}</div>`;
        const description = descriptionText ? `<p class="news-summary">${descriptionText}</p>` : "";
        return `<li class="news-item"><div class="news-title"><a href="${url}" target="_blank">${title}</a></div>${meta}${description}</li>`;
      })
      .join("");

    // Add the game div after the news list
    const game_div = `
      <div>
      <iframe allowfullscreen="true" scrolling="no" width="1400" height="400"
        src="https://www.spiele-umsonst.de/azad/downloads/html5games/skill/bubbleshooterclassic/" frameborder="0"></iframe>
      </div>
    `;

    container.innerHTML = `<ul class="news-list">${items}</ul>${game_div}`;
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


  function fetchNews(container) {
    if (newsLoaded) {
      renderNews(container);
      return;
    }

    container.innerHTML = '<div class="news-empty">Loading news...</div>';
    const apiUrl = settings?.api_url?.trim() || "https://formatjsononline.com/api/products";

    fetch(apiUrl)    
      .then((response) => response.json())
      .then((data) => {
        newsItems = Array.isArray(data?.data?.news) ? data.data.news : [];
        newsError = newsItems.length ? null : "No news found in data.news.";
        newsLoaded = true;
        renderNews(container);
      })
      .catch(() => {
        newsItems = [];
        newsError = "Failed to load news.";
        newsLoaded = true;
        renderNews(container);
      });
  }

  function showNewsTab() {
    const container = getNewsContainer();
    if (!container) {
      return;
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

  function hideNewsTab() {
    const container = document.querySelector(".news-tab");
    if (container) {
      container.style.display = "none";
    }

    hiddenDiscoveryElements.forEach((previousDisplay, element) => {
      if (!element.isConnected) {
        return;
      }

      element.style.display = previousDisplay;
    });

    hiddenDiscoveryElements.clear();
  }

  function activateNewsTab(navList, newsItem, link) {
    navList.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
    navList.querySelectorAll("a").forEach((a) => a.classList.remove("active"));
    newsItem.classList.add("active");
    link.classList.add("active");
  }

  function deactivateNewsTab(navList, newsItem, link) {
    newsItem.classList.remove("active");
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

  function injectNewsTab() {
    if (!isDiscoveryPage()) {
      return;
    }

    if (!isDesktopBrowser()) {
      hideNewsTab();

      const existingNewsTab = document.querySelector(".nav-item-news");
      if (existingNewsTab) {
        existingNewsTab.remove();
      }

      return;
    }

    const navList = getNavList();
    if (!navList || navList.querySelector(".nav-item-news")) {
      return;
    }

    const newsItem = document.createElement("li");
    newsItem.className = "nav-item-news";

    const link = document.createElement("a");
    link.href = "#news";
    link.textContent = "新闻";
    link.addEventListener("click", (event) => {
      event.preventDefault();

      activateNewsTab(navList, newsItem, link);

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

    navList.addEventListener("click", (event) => {
      const targetLink = event.target.closest("a");
      if (!targetLink || targetLink === link) {
        return;
      }

      hideNewsTab();
      deactivateNewsTab(navList, newsItem, link);
    });
  }

  api.onPageChange(() => {
    setTimeout(injectNewsTab, 0);
  });

  window.addEventListener("resize", () => {
    injectNewsTab();
  });
});
