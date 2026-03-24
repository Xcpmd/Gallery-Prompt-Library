var nsfw = 0;
var pageNow = "";
var defaultKey = "";

// 生成哈希值id
function vaid(str) {
  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;

  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    const char = BigInt(str.charCodeAt(i));
    hash ^= char;
    hash *= FNV_PRIME;
    hash &= 0xffffffffffffffffn;
  }

  // 转换为十六进制字符串（定长16字符，不足补零）
  return hash.toString(16).padStart(16, "0").replace(/-/g, "_");
}

// 生成url
function u(url, params = {}) {
  return `${url}?${new URLSearchParams(params)}`;
}

// 发送分类请求
async function getCategories() {
  const url = `/getCategories?nsfw=${nsfw}`;
  const response = await fetch(url);
  return await response.json();
}

// 渲染分类项
async function renderCategories() {
  // 等待数据返回
  const data = Array.from(await getCategories());
  const element = document.getElementById("categories");

  let exist = {};
  const idAndZh = {};
  data.map((t) => {
    idAndZh[t[0]] = t[1];
  });
  let Ids = data.map((d) => {
    return d[0].trim();
  });
  Array.from(element.children).map((card) => {
    let id = card.id.split("-")[2];
    if (Ids.includes(id)) {
      let clonedCard = card.cloneNode(true);
      let target = clonedCard.children[0].children[0].children[1];
      if (target) {
        target.innerText = idAndZh[id];
      }

      exist[id] = clonedCard.outerHTML;
    }
  });

  let htmlString = "";
  // 渲染内容
  data.map((title) => {
    category = title[0].trim();
    nameZh = title[1].trim();

    let template =
      exist[category] ||
      /* html */ `
        <div id='category-box-${category}'>
          <div id="category-${category}" class="category-option" onclick="categoryContent('${category}')">
            <div class="category-option-title">
              <div class="folder-icon">
                <i class="fa-solid fa-folder"></i>
              </div>
              <p class="category-title">${nameZh}</p>
            </div>
            <div class="category-icons">
            <!-- 编辑按钮 -->
              <div class="icon edit-btn" data-id="${category}-${nameZh}" onclick="editCategory(event, this)">
                <i class="fa-solid fa-pen-to-square"></i>
              </div>
              <!-- 启闭状态显示 -->
              <div class="angle-icon">
                <i class="fa-solid fa-angle-down"></i>
              </div>
            </div>
          </div>
          <div id="category-inner-${category}" class="category-inner"></div>
        </div>
          `;
    htmlString += template;
  });
  element.innerHTML = htmlString;

  data.map((title) => {
    category = title[0];
    categoryContent(category, true);
  });
}

async function renderWorks() {
  const url = "/getWorks";
  const data = Array.from(await (await fetch(url)).json());

  const element = document.getElementById("categories");
  console.log(data);

  if (!document.getElementById("works-box")) {
    if (data.length > 0) {
      let worksCategoryTemplate = /* html */ `
          <hr>
          <div id='works-box'>
            <div id="works-category" class="category-option" onclick="renderWork()">
              <div class="category-option-title">
                <div class="folder-icon">
                  <i class="fa-solid fa-folder"></i>
                </div>
                <p class="category-title">作品</p>
              </div>
              <div class="category-icons">
              <!-- 编辑按钮 -->
                <div class="icon edit-btn" onclick="addWork(event)">
                  <i class="fa-solid fa-plus"></i>
                </div>
                <!-- 启闭状态显示 -->
                <div class="angle-icon">
                  <i class="fa-solid fa-angle-down"></i>
                </div>
              </div>
            </div>
            <div id="work-inner" class="category-inner">
            </div>
          </div>`;
      element.insertAdjacentHTML("afterend", worksCategoryTemplate);
    }
  }
}

// 渲染作品分类
async function renderWork(immediately = false) {
  const element = document.getElementById("work-inner");
  if (element && !immediately) {
    const angleIcon = element.parentElement.querySelector(".angle-icon");
    if (element.classList.contains("active")) {
      element.classList.remove("active");
      setTimeout(() => {
        angleIcon.classList.remove("active");
      }, 200);
    } else {
      element.classList.add("active");
      angleIcon.classList.add("active");
    }
  }

  const url = "/getWorks";
  const data = Array.from(await (await fetch(url)).json());

  const Ids = data.map((eaz) => {
    return eaz[0];
  });
  const existWork = {};
  Array.from(element.children).map((child) => {
    let id = child.getAttribute("name");
    if (id in Ids) {
      existWork[id] = child.outerHTML;
    }
  });

  const works = data
    .map((work) => {
      const id = work[0];
      const name = work[1];

      return (
        existWork[id] ||
        /* html */ `
    <div id="key-${vaid(id + name)}" class="category-key" name="${id}" data-name="${name}" onclick="renderCharaCards(this)">
      <p>${name}</p>
      <div class="icon child-edit-btn" data-id="${id}" data-name="${name}" onclick="editWork(this, event)">
        <i class="fa-solid fa-pen-to-square"></i>
      </div>
    </div>`
      );
    })
    .join("");

  element.innerHTML = works;
}

// 渲染角色卡片
async function renderCharaCards(self) {
  const work = self.getAttribute("name");
  const element = document.getElementById("prompt-content");
  const url = "/getCharas";
  const params = {
    work: work,
  };

  const response = await (await fetch(u(url, params))).json();

  element.setAttribute("data-work", work);
  const ids = Array.from(response).map((id) => {
    return id[0];
  });
  document.getElementsByName("prompt-ceil").forEach((card) => {
    if (!(card.getAttribute("data-en") in ids)) {
      card.classList.remove("fade-in");
      setTimeout(card.remove, 300);
    }
  });

  let htmlString = "";
  Array.from(response).map((chara) => {
    const id = chara[0];
    const name = chara[1];
    const img = chara[2];

    let fadedIn = element
      .querySelector(`#prompt-ceil-${vaid(id + name)}`)
      ?.classList.contains("fade-in")
      ? " fade-in"
      : "";
    const imgElement = img
      ? /* html*/ `<div id="chara-img-${vaid(id + name)}" class="chara-img"><img src='${img}'></div>`
      : "";

    let template = /* html */ `
      <div class='prompt-ceil${fadedIn}' id="prompt-ceil-${vaid(id + name)}" data-en="${id}" data-zh="${name}" data-img="${img}" onclick='addPositiveCart(this, true)'>
        ${imgElement}
        <div class="prompt-ceil-content">
          <p class='en'>${id}</p>
          <p class='zh'>${name}</p>
        </div>
        <div class="ceil-edit-btn" onclick="editChara(this, event)">
          <i class="fa-solid fa-pen-to-square"></i>
        </div>
      </div>`;
    htmlString += template;
  });
  element.innerHTML = htmlString;
  element.setAttribute("data-type", "work");
  element.setAttribute("data-page", work + self.getAttribute("data-name"));
  afterRenderPromptCeil();
}

// 渲染分类子项
async function categoryContent(category, reflash = false) {
  const element = document.getElementById(`category-inner-${category}`);
  if (element && !reflash) {
    const angleIcon = element.parentElement.querySelector(".angle-icon");
    if (element.classList.contains("active")) {
      element.classList.remove("active");
      setTimeout(() => {
        angleIcon.classList.remove("active");
      }, 200);
    } else {
      element.classList.add("active");
      angleIcon.classList.add("active");
    }
  }

  const url = `/category/${category}?nsfw=${nsfw}`;
  let response = await fetch(url);
  let data = Array.from(await response.json());

  // 已有子项
  let existKey = {};
  Array.from(element.children).map((child) => {
    let id = child.getAttribute("name");
    if (data.includes(id)) {
      existKey[id] = child.outerHTML;
    }
  });
  // 渲染

  let htmlString = data
    .map((key) => {
      let title = key;
      if (key == "default") title = "默认";

      return (
        existKey[key] ||
        /* html */ `
      <div id="key-${vaid(category)}-${vaid(key)}" class="category-key" name="${key}" onclick="renderPrompts(this, '${category}', '${key}')">
        <p>${title}</p>
        <div class="icon child-edit-btn" data-id="${category}-${key}" onclick="editChildCategory(event, this)">
          <i class="fa-solid fa-pen-to-square"></i>
        </div>
      </div>`
      );
    })
    .join("");
  // 添加子分类按钮
  htmlString += /* html*/ `
        <div id="key-${vaid(category)}-add-btn" class="category-key" onclick="addChildCategory('${category}')">
          <i class="fa-solid fa-plus"></i>
        </div>`;
  element.innerHTML = htmlString;
  return;
}

// 渲染提示词卡片
async function renderCard(element, data, immediately = false) {
  const cartPositive = document.getElementById("cart-positive");
  const cartNegative = document.getElementById("cart-negative");
  const cards = Array.from(data);

  let htmlString = "";
  if (cards.length == 0) {
    htmlString += "<p>无内容</p>";
  }
  cards.map((singlePrompt) => {
    let en = singlePrompt[0].trim();
    let zh = singlePrompt[1].trim();
    let r = singlePrompt[2];

    let target = document.getElementById(`cart-in-${vaid(en + zh)}`);
    let inPosi = cartPositive.contains(target);
    let inNega = cartNegative.contains(target);

    let active = "";
    if (inPosi) {
      active = " positive";
    } else if (inNega) {
      active = " negative";
    }

    let exist = element.querySelector(
      `#prompt-ceil-${vaid(en + zh)}`,
    )?.outerHTML;

    let template =
      exist ||
      /* html */ `
      <div class='prompt-ceil${active}' id="prompt-ceil-${vaid(en + zh)}" data-en="${en}" data-zh="${zh}" data-r="${r}" onclick='addPositiveCart(this)'>
        <div class="prompt-ceil-content">
          <p class='en'>${en}</p>
          <p class='zh'>${zh}</p>
        </div>
        <div class="ceil-edit-btn" data-r="${r}" onclick="editPrompt(event, this)">
          <i class="fa-solid fa-pen-to-square"></i>
        </div>
      </div>`;
    htmlString += template;
  });
  element.innerHTML = htmlString;
  afterRenderPromptCeil();
}

async function afterRenderPromptCeil() {
  reloadCeil();
  Array.from(document.getElementsByClassName(`prompt-ceil`)).map((card) => {
    setTimeout(() => {
      card.classList.add("fade-in");
      card.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        e.stopPropagation();
        addNegativeCart(this);
      });
    }, 50);
  });
  setTimeout(reloadPromptCount, 100);
}

// 子分类点击事件
async function renderPrompts(self, category, key, immediately = false) {
  const url = `/prompt`;
  const params = {
    category: category,
    key: key,
    nsfw: nsfw,
  };
  // console.log(url)
  const element = document.getElementById("prompt-content");
  document.querySelectorAll(".category-key").forEach((option) => {
    option.classList.remove("active");
  });
  self.classList?.add("active");

  element.setAttribute("data-category", category);
  element.setAttribute("data-key", key);

  const data = await (await fetch(u(url, params))).json();
  element.setAttribute("data-type", "default");
  //渲染卡片
  renderCard(element, data, (immediately = immediately));
}

//添加至购物车: 正面
async function addPositiveCart(card, isChara = false) {
  const element = document.getElementById("cart-positive");

  const cartNegative = document.getElementById("cart-negative");
  const work = document
    .getElementById("prompt-content")
    .getAttribute("data-work");

  let en = card.getAttribute("data-en");
  let zh = card.getAttribute("data-zh");

  let inCart = element.querySelector(`#cart-in-${vaid(en + zh)}`);
  let inNega = cartNegative.querySelector(`#cart-in-${vaid(en + zh)}`);
  if (inNega) {
    // 不在正面 && 在负面
    card.classList.remove("negative");
    card.classList.add("positive");
    inNega.classList.remove("active");
    setTimeout(() => {
      inNega.remove();
    }, 300);
  }
  if (!inCart) {
    //不在正面 && 不在负面
    card.classList.add("positive");

    let template = /* html */ `
        <div id='cart-in-${vaid(en + zh)}' class='in-cart' data-en="${en}" data-zh="${zh}">
          <div class="content">
            <p class='e'>${isChara ? `${en}(${work})` : en}</p>
            <p class='z'>${zh}</p>
          </div>
          <div class="prompt-ceil-rm-btn" onclick='removePrompt(this)'>
            <i class="fa-solid fa-xmark"></i>
          </div>
        </div>`;

    element.innerHTML += template;
    setTimeout(() => {
      element
        .querySelector(`#cart-in-${vaid(en + zh)}`)
        ?.classList.add("active");
    }, 300);
  } else {
    // 在正面 && 不在负面
    card.classList.remove("positive");
    inCart.classList.remove("active");
    setTimeout(() => {
      inCart.remove();
    }, 300);
  }
}

//添加至购物车: 负面
async function addNegativeCart(card, isChara = false) {
  const element = document.getElementById("cart-negative");

  const cartPositive = document.getElementById("cart-positive");
  const work =
    document.getElementById("prompt-content").getAttribute("data-work") || "";

  let en = card.getAttribute("data-en");
  let zh = card.getAttribute("data-zh");

  let inCart = element.querySelector(`#cart-in-${vaid(en + zh)}`);
  let inPosi = cartPositive.querySelector(`#cart-in-${vaid(en + zh)}`);
  if (inPosi) {
    card.classList.remove("positive");
    card.classList.add("negative");
    inPosi.classList.remove("active");
    setTimeout(() => {
      inPosi.remove();
    }, 300);
  }
  if (!inCart) {
    card.classList.add("negative");

    let template = /* html */ `
          <div id='cart-in-${vaid(en + zh)}' class='in-cart' data-en="${en}" data-zh="${zh}">
            <div class="content">
              <p class='e'>${isChara ? `${en}(${work})` : en}</p>
              <p class='z'>${zh}</p>
            </div>
            <div class="prompt-ceil-rm-btn" onclick='removePrompt(this)'>
              <i class="fa-solid fa-xmark"></i>
            </div>
          </div>`;

    element.innerHTML += template;
    setTimeout(() => {
      element
        .querySelector(`#cart-in-${vaid(en + zh)}`)
        ?.classList.add("active");
    }, 300);
  } else {
    // 在正面 && 不在负面
    card.classList.remove("negative");
    inCart.classList.remove("active");
    setTimeout(() => {
      inCart.remove();
    }, 300);
  }
}

async function copyCallBack(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(content);
    createMessage("已复制到剪切板", 3, "good");
  }else{
    const element = document.createElement('textarea');
    element.value = text;
    element.style.position = 'fixed';
    element.style.opacity = '0';
    element.style.pointerEvents = 'none';
  
    document.body.appendChild(element);
    element.select();
    element.setSelectionRange(0, text.length);
    
    try {
      document.execCommand('copy');
      createMessage("已复制到剪切板", 3, "good");
    } catch(err) {
      createMessage('!请前往 复制结果 手动复制', 3,'bad');
    }
    document.body.removeChild(element);
  }
}

//复制
function copy(btn) {
  let element =
    btn.parentElement.parentElement.parentElement.querySelector(".cart");
  let result = [];

  const underline = document.getElementById("underline-input").checked;
  const escaping = document.getElementById("escape-input").checked;
  const resultShower = document.getElementById("copy-result");
  const showerContent = document.getElementById("copy-result-shower");

  element.querySelectorAll(".in-cart").forEach((card) => {
    tag = card.querySelector(".e").innerText;
    let p = escaping ? tag.replace(/\(|\)/g, "\\$&") : tag;
    result.push(p);
  });
  result = result.join(", ");
  let content = underline ? result.replace(/_/g, " ") : result;

  if (result) {
    copyCallBack(content);
    // if (navigator.clipboard) {
    //   navigator.clipboard.writeText(content);
    //   createMessage("已复制到剪切板", 3, "good");
    // }else{
    //   createMessage('!请前往 复制结果 手动复制', 3,'bad')
    // }
    showerContent.classList.remove("active");
    setTimeout(() => {
      resultShower.innerText = content;
      showerContent.classList.add("active");
    }, 300);
  } else {
    createMessage("空内容", 3);
  }
  console.log(content);
}

var CartClearId = {
  positive: null,
  negative: null,
};

//清空购物车
function clearCart(btn) {
  let element =
    btn.parentElement.parentElement.parentElement.querySelector(".cart");
  let type = btn.getAttribute("name");
  reloadCeil();
  // let id = null;

  if (btn.classList.contains("active")) {
    createMessage("已清空购物车");
    btn.classList.remove("active");
    clearTimeout(CartClearId[type]);
    CartClearId[type] = null;
    Array.from(element.children).map((card) => {
      removePrompt(card.querySelector(".prompt-ceil-rm-btn"));
    });
  } else {
    createMessage("确认清空购物车吗?", 5, "warn");
    btn.classList.add("active");
    CartClearId[type] = setTimeout(() => {
      btn.classList.remove("active");
    }, 5000);
  }
}

//从购物车移除单个prompt
function removePrompt(tag) {
  const cardContent = tag.parentElement;
  const en = cardContent.getAttribute("data-en");
  const zh = cardContent.getAttribute("data-zh");

  document
    .getElementById(`prompt-ceil-${vaid(en + zh)}`)
    ?.classList.remove("positive", "negative");

  tag.parentElement.classList.remove("active");
  setTimeout(() => {
    tag.parentElement.remove();
  }, 300);
}

// 切换nsfw
function switchNsfw(element) {
  nsfw = nsfw ? 0 : 1;
  let btnIcon = element.children[0].classList;
  if (nsfw) {
    btnIcon.remove("fa-ban");
    btnIcon.add("fa-check");
    element.setAttribute("title", "新世界!!!");
    createMessage("新世界!", 3, "good");
  } else {
    btnIcon.remove("fa-check");
    btnIcon.add("fa-ban");
    element.setAttribute("title", "???");
  }

  reflash(true);
}

// 刷新内容
async function reflash(immediately = false) {
  const input = document.getElementById("search-box");

  let value = input.value.trim();
  if (value) searchSend(value);

  renderCategories();
  reloadCeil();
  renderWorks();
  renderWork(true);
  const element = document.getElementById("prompt-content");
  if (element.getAttribute("data-type") == "work") {
    const n = element.getAttribute("data-page");
    renderCharaCards(document.getElementById(`key-${vaid(n)}`));
  }
  const category =
    document.getElementById("prompt-content").getAttribute("data-category") ||
    "";
  const key =
    document.getElementById("prompt-content").getAttribute("data-key") || "";

  if (category && key) {
    const element = document.getElementById(
      `key-${vaid(category)}-${vaid(key)}`,
    );
    renderPrompts(element, category, key, (immediately = immediately));
  }
  reloadPromptCount();
}

async function reloadPromptCount() {
  const defaultPrompt = document.getElementById("prompt-content");
  const searchPrompt = document.getElementById("prompt-search-content");
  const statusPromptCount = document.getElementById("prompt-load-count");

  const value =
    defaultPrompt.getElementsByClassName("prompt-ceil").length +
    searchPrompt.getElementsByClassName("prompt-ceil").length;

  statusPromptCount.innerText = `已加载${value}个prompt`;
}

// 刷新卡片状态
async function reloadCeil() {
  const cartPositive = document.getElementById("cart-positive");
  const cartNegative = document.getElementById("cart-negative");

  Array.from(document.getElementsByClassName("prompt-ceil")).map((self) => {
    let en = self.getAttribute("data-en");
    let zh = self.getAttribute("data-zh");

    let target = document.getElementById(`cart-in-${vaid(en + zh)}`);
    let inPosi = cartPositive.contains(target);
    let inNega = cartNegative.contains(target);

    if (inPosi) {
      self.classList.remove("negative");
      self.classList.add("positive");
    } else if (inNega) {
      self.classList.remove("positive");
      self.classList.add("negative");
    } else {
      self.classList.remove("positive", "negative");
    }
  });
}

// 刷新连接状态
async function getStatus() {
  const url = `/status?nsfw=${nsfw}`;
  const data = await (await fetch(url)).json();
  const statusIcon = document.getElementById("connect-status");

  if (data.code == "200") {
    statusIcon.classList.remove("bad");
    statusIcon.classList.add("well");
    statusIcon.setAttribute("title", "连接良好");
  } else {
    statusIcon.classList.remove("well");
    statusIcon.classList.add("bad");
    statusIcon.setAttribute("title", "失去连接");
    createMessage("尝试连接中", 2, "bad");
  }
}

// 搜索框处理
var inputDelay = performance.now();

var timer = null; // 保存延时器ID
function debounce(func, delay) {
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args); // 保留this和参数
    }, delay);
  };
}

// 发送搜索
async function searchSend(value) {
  const url = `/search/${value}?nsfw=${nsfw}`;
  const data = await (await fetch(url)).json();
  console.log(data);

  const element = document.getElementById("prompt-search-content");
  renderCard(element, data);

  if (value) {
    document.getElementById("divider").classList.add("show");
  } else {
    document.getElementById("divider").classList.remove("show");
    setTimeout(reloadPromptCount, 100);
  }
}

// 创建信息
var messageIndex = 0;
async function createMessage(text, time = 5, level = "normal") {
  const element = document.getElementById("message-box");
  messageIndex++;
  // 默认图标 (i)
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  // 处理长信息
  if (text.length > 24) {
    text = text.slice(0, 15);
    text += "...";
  }

  switch (level) {
    case "bad":
      // (x)
      icon = '<i class="fa-solid fa-circle-xmark"></i>';
      break;
    case "good":
      // (√)
      icon = '<i class="fa-solid fa-circle-check"></i>';
      break;
    case "warn":
      icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  }

  let template = /* html */ `
  <div id= "message-${vaid(text)}-${messageIndex}" class="message-container ${level}">
    <div class="message-card">
      <div class="message-icon">
        ${icon}
      </div>
      <p>${text}</p>
    </div>
    <svg class="message-down-container">
      <line x1="0" y1="0" x2="100%" y2="0" id="message-line-${vaid(text)}-${messageIndex}" class="message-down" style="--duration: ${time}s"/>
    </svg>
  </div>`;

  element.insertAdjacentHTML("beforeend", template);
  // 添加动画
  setTimeout(() => {
    let message = element.querySelector(
      `#message-${vaid(text)}-${messageIndex}`,
    );
    message.classList.add("fade-in");
    element
      .querySelector(`#message-line-${vaid(text)}-${messageIndex}`)
      .classList.add("active");
    setTimeout(() => {
      message.classList.remove("fade-in");
      setTimeout(() => {
        message.remove();
      }, 300);
    }, time * 1000);
  }, 50);
}

///////////////////////////////////////////////////////////
// 提示词编辑函数
///////////////////////////////////////////////////////////

// 新建弹窗
async function addPopUpWindow(
  content,
  submit,
  title = "Title",
  icon = '<i class="fa-solid fa-circle-info"></i>',
  removeBtn = null,
) {
  const windowContainer = document.getElementById("pop-up");
  windowContainer.classList.add("active");

  // 存储回调函数到全局
  window.__popupSubmitCallback = submit;
  window.__popupRemoveCallback = removeBtn;
  const remove = removeBtn
    ? /* html */ `
      <div id="pop-up-remove-btn" class="clear-btn pop-up-remove-btn" onclick="popUpSubmit(true)">
        <i class="fa-solid fa-trash"></i>
      </div>`
    : "";

  let template = /* html */ `
  <div id="pop-up-box" class="pop-up-box card">
    <div class="pop-up-bar">
      <div class="pop-up-title">
        ${icon}
        <h4>${title}</h4>
      </div>
      <div id="pop-up-close-btn" class="icon close-btn" onclick="closePopUpWindow()">
        <i class="fa-solid fa-xmark"></i>
      </div>
    </div>
    <hr>
    <div id="pop-up-content">
      ${content}
    </div>
    <div id="pop-up-submit" class="pop-up-submit">
      ${remove}
      <div class="pop-up-submit-btn" onclick="popUpSubmit()">
        <i class="fa-solid fa-arrow-up-from-bracket"></i>
        <p>提交</p>
      </div>
    </div>
  </div>`;

  windowContainer.insertAdjacentHTML("afterbegin", template);
  setTimeout(() => {
    windowContainer.querySelector("#pop-up-box").classList.add("fade-in");
    document.addEventListener("keydown", (event) => {
      if (
        event.key == "Enter" &&
        windowContainer.classList.contains("active")
      ) {
        popUpSubmit();
      }
    });
    fileInputAnime();
  }, 50);
}

//关闭弹窗
async function closePopUpWindow() {
  const windowContainer = document.getElementById("pop-up");

  windowContainer.querySelector("#pop-up-box").classList.remove("fade-in");
  windowContainer.classList.remove("active");
  setTimeout(() => {
    windowContainer.innerHTML = "";
  }, 200);
}

/////////
// 弹窗模块

// 文本框
function addTextBox(title, defaultText = "") {
  return /* html */ `
  <div class="pop-up-text-box">
    <p class="pop-up-input-title">${title}</p>
    <input type="text" id="pop-up-text-${title}" class="pop-up-input-box" name="${title}" placeholder="${defaultText}">
  </div>`;
}

function addInfo(id, info) {
  return /*html*/ `
  <input type="text" class="pop-up-input-info" name="${id}" placeholder="${info}">`;
}

function addBtn(title, turnOn = false) {
  return /*html*/ `
  <div class="pop-up-checkbox-box">
    <p class="pop-up-input-title">${title}<p>
    <label class="select-box">
      <input type="checkbox" name="${title}"${turnOn ? " checked" : ""}>
      <span class="select-slider"></span>
    </label>
  </div>`;
}

function addFileIuput(
  title,
  type = "image/*",
  defaultImage = "",
  icon = '<i class="fa-solid fa-arrow-up-from-bracket"></i>',
) {
  const fadedIn = defaultImage ? "fade-in" : "";
  return /* html */ `
  <div class="pop-up-file-upload" title='上传图片'>
    <input id="file-upload" class="file-upload-input" type='file' name="${title}" accept="${type}"/>
    <label for="file-upload" class="file-upload">
      <img id="file-preview" class='${fadedIn}' src="${defaultImage}">
      ${defaultImage ? "" : icon}
      <p>${title}</p>
    </label>
    <div class='btn-posi'>
      <div class='clear-btn file-rm-btn' title="清除内容" onclick="clearFileContent(this)">
        <i class="fa-solid fa-trash"></i>
      </div>
    </div>
  </div>`;
}

async function solveResponse(url, params) {
  const response = (await (await fetch(u(url, params))).text()).split("%");
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

// 按钮触发
function popUpSubmit(remove = false) {
  const form = document.getElementById("pop-up-content");

  let result = {};
  Array.from(form.getElementsByTagName("input")).map((self) => {
    const name = self.getAttribute("name");
    switch (self.getAttribute("type")) {
      case "text":
        const value = self.value.trim() || self.getAttribute("placeholder");
        result[name] = value;
        return;
      case "checkbox":
        result[name] = self.checked ? 1 : 0;
        return;
      case "file":
        result[name] = self.files.item(0);
        return;
    }
  });

  // 调用存储的回调并传入数据
  if (
    typeof window.__popupSubmitCallback === "function" ||
    typeof window.__popupRemoveCallback === "function"
  ) {
    if (remove) {
      const Btn = document.getElementById("pop-up-remove-btn");
      const active = Btn.classList.contains("active");
      if (active) {
        window.__popupRemoveCallback(result);
        closePopUpWindow();
        reflash();
        delete window.__popupRemoveCallback;
      } else {
        Btn.classList.add("active");
        setTimeout(() => {
          Btn.classList.remove("active");
        }, 3000);
      }
    } else {
      window.__popupSubmitCallback(result);
      closePopUpWindow();
      reflash();
      delete window.__popupSubmitCallback;
    }
  }
}

///////////////////////////////////////////////
// 使用弹窗的函数
///////////////////////////////////////////////

// 添加分类
async function addCategorySubmit(data) {
  const id = data["ID"];
  const name = data["翻译"];
  console.log(id, name);

  if (!id || !name) {
    createMessage("内容不能为空", 5, "bad");
    return;
  }

  const url = "/editCategory";
  const params = {
    id: id,
    name: name,
    type: "add",
  };

  solveResponse(url, params);
}

//新建分类
async function addCategory() {
  const content = addTextBox("ID") + addTextBox("翻译");
  addPopUpWindow(
    content,
    addCategorySubmit,
    "添加分类",
    '<i class="fa-solid fa-bookmark"></i>',
  );
}
//////////

// 修改分类

async function removeCategorySubmit(data) {
  const fromId = data["fromid"];
  const fromName = data["fromName"];

  console.log(fromId);
  const url = "/editCategory";
  const params = {
    id: fromId,
    name: fromName,
    type: "remove",
  };

  solveResponse(url, params);
}

async function editCategorySubmit(data) {
  const id = data["ID"];
  const name = data["翻译"];
  const fromId = data["fromid"];

  if (!id || !name) {
    createMessage("内容不能为空", 5, "bad");
    return;
  }

  console.log(fromId, id, name);
  const url = "/editCategory";
  const params = {
    id: id,
    name: name,
    type: "edit",
    fromId: fromId,
  };

  solveResponse(url, params);
}

async function editCategory(event, self) {
  event.stopPropagation();
  const idAndZh = self.getAttribute("data-id").split("-");
  const id = idAndZh[0];
  const name = idAndZh[1];

  const content =
    addTextBox("ID", id) +
    addTextBox("翻译", name) +
    addInfo("fromid", id) +
    addInfo("fromName", name);
  addPopUpWindow(
    content,
    editCategorySubmit,
    `修改${name}`,
    '<i class="fa-solid fa-pen-to-square"></i>',
    removeCategorySubmit,
  );
}

// 添加子分类

async function addChildCategorySubmit(data) {
  const nsfw = data["NSFW?"];
  const name = data["名称"];
  const category = data["category"];
  if (name) {
    const url = `/editChildCategory/${category}`;
    const params = {
      name: name,
      type: "add",
      nsfw: nsfw,
    };

    const response = (await (await fetch(u(url, params))).text()).split("%");
    const text = response[0];
    const level = response[1];
    createMessage(text, 3, level);
  } else createMessage("请输入有效名称", 5, "bad");
}

async function addChildCategory(category) {
  const content =
    addTextBox("名称") + addBtn("NSFW?") + addInfo("category", category);
  addPopUpWindow(
    content,
    addChildCategorySubmit,
    "添加子分类",
    '<i class="fa-regular fa-bookmark"></i>',
  );
}

// 修改子分类

async function editChildCategorySubmit(data) {
  const name = data["名称"];
  const category = data["category"];
  const fromName = data["fromName"];

  if (!name) {
    createMessage("内容不能为空", 5, "bad");
    return;
  }

  console.log(category, fromName, name);
  const url = `/editChildCategory/${category}`;
  const params = {
    name: name,
    from: fromName,
    type: "edit",
  };

  solveResponse(url, params);
}

async function removeChildCategorySubmit(data) {
  const fromName = data["fromName"];

  console.log(category, fromName);
  const url = `/editChildCategory/${category}`;
  const params = {
    name: fromName,
    type: "remove",
  };

  solveResponse(url, params);
}

async function editChildCategory(event, self) {
  event.stopPropagation();
  const idAndZh = self.getAttribute("data-id").split("-");
  const category = idAndZh[0];
  const name = idAndZh[1];

  const content =
    addTextBox("名称", name) +
    addInfo("fromName", name) +
    addInfo("category", category);
  addPopUpWindow(
    content,
    editChildCategorySubmit,
    `修改${name}`,
    '<i class="fa-solid fa-pen-to-square"></i>',
    removeChildCategorySubmit,
  );
}

// 添加提示词

async function addPromptSubmit(data) {
  const en = data["tag"];
  const zh = data["译"];
  const isNsfw = data["NSFW?"];
  const category = data["category"];
  const key = data["key"];

  const url = "/editPrompt";
  const params = {
    en: en,
    zh: zh,
    nsfw: isNsfw,
    category: category,
    key: key,
    type: "add",
  };

  solveResponse(url, params);
}

// 添加角色

async function addCharaSubmit(data) {
  console.log(data);
  const id = data["tag"];
  const name = data["译"];
  const work = data["work"];
  const image = data["上传图片"];

  if (!id || !name) {
    createMessage("内容不可为空", 3, "bad");
    return;
  }

  const form = new FormData();
  if (image) {
    if (image.size > 5 * 1024 * 1024) {
      createMessage("图片不能超过5MB");
      return;
    }
  }
  const url = "/editChara";
  const params = {
    id: id,
    name: name,
    work: work,
    type: "add",
  };
  form.append("image", image || "");

  const response = await fetch(u(url, params), {
    method: "POST",
    body: form,
  });

  if (response.ok) {
    const t = (await response.text()).split("%");
    const text = t[0];
    const level = t[1];
    createMessage(text, 3, level);
  }
}

async function addPrompt() {
  const element = document.getElementById("prompt-content");
  const type = element.getAttribute("data-type");
  if (type == "default") {
    const category = element.getAttribute("data-category");
    const key = element.getAttribute("data-key");
    const content =
      addTextBox("tag") +
      addTextBox("译") +
      addBtn("NSFW?", false) +
      addInfo("category", category) +
      addInfo("key", key);
    addPopUpWindow(
      content,
      addPromptSubmit,
      "添加提示词",
      '<i class="fa-solid fa-tag"></i>',
    );
  } else if (type == "work") {
    const work = document
      .getElementById("prompt-content")
      .getAttribute("data-work");
    const content =
      addTextBox("tag") +
      addTextBox("译") +
      addFileIuput("上传图片") +
      addInfo("work", work);
    addPopUpWindow(
      content,
      addCharaSubmit,
      "添加角色",
      '<i class="fa-solid fa-circle-user"></i>',
    );
  } else {
    createMessage("请选择分类", 5, "bad");
  }
}

async function removePromptSubmit(data) {
  const fromNSFW = data["FromNSFW"];
  const category = data["category"];
  const key = data["key"];
  const fromEn = data["fromEn"];
  const fromZh = data["fromZh"];

  const url = "/editPrompt";
  const params = {
    fromEn: fromEn,
    fromZh: fromZh,
    fromNSFW: fromNSFW == "true" ? 1 : 0,
    category: category,
    key: key,
    type: "remove",
  };

  solveResponse(url, params);
}

async function editPromptSubmit(data) {
  const en = data["tag"];
  const zh = data["译"];
  const isNsfw = data["NSFW?"];
  const fromNSFW = data["FromNSFW"];
  const category = data["category"];
  const key = data["key"];
  const fromEn = data["fromEn"];
  const fromZh = data["fromZh"];

  const url = "/editPrompt";
  const params = {
    fromEn: fromEn,
    fromZh: fromZh,
    fromNSFW: fromNSFW == "true" ? 1 : 0,
    en: en,
    zh: zh,
    nsfw: isNsfw,
    category: category,
    key: key,
    type: "edit",
  };

  solveResponse(url, params);
}

// 编辑提示词
async function editPrompt(event, self) {
  event.stopPropagation();
  const category = document
    .getElementById("prompt-content")
    .getAttribute("data-category");
  const key = document
    .getElementById("prompt-content")
    .getAttribute("data-key");
  if (!category || !key) {
    createMessage("请选择分类", 5, "bad");
    return;
  }

  const c = self.parentElement;
  const en = c.getAttribute("data-en");
  const zh = c.getAttribute("data-zh");
  const r = self.getAttribute("data-r") == 1;

  const content =
    addTextBox("tag", en) +
    addTextBox("译", zh) +
    addBtn("NSFW?", r) +
    addInfo("FromNSFW", r) +
    addInfo("category", category) +
    addInfo("key", key) +
    addInfo("fromEn", en) +
    addInfo("fromZh", zh);
  addPopUpWindow(
    content,
    editPromptSubmit,
    "修改提示词",
    '<i class="fa-solid fa-tag"></i>',
    removePromptSubmit,
  );
}

// 添加作品

async function addWorkSubmit(data) {
  const id = data["tag"];
  const name = data["译"];

  const url = "/editWork";
  const params = {
    id: id,
    name: name,
    type: "add",
  };

  const response = (await (await fetch(u(url, params))).text()).split("%");
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function addWork(event) {
  event.stopPropagation();
  const content = addTextBox("tag") + addTextBox("译");
  addPopUpWindow(
    content,
    addWorkSubmit,
    "添加作品",
    '<i class="fa-solid fa-plus"></i>',
  );
}

// 编辑作品

async function removeWork(data) {
  const fromId = data["fromId"];

  const url = "/editWork";
  const params = {
    fromID: fromId,
    type: "remove",
  };

  solveResponse(url, params);
}

async function editWorkSubmit(data) {
  const fromId = data["fromId"];
  const id = data["tag"];
  const name = data["译"];

  const url = "/editWork";
  const params = {
    fromID: fromId,
    id: id,
    name: name,
    type: "edit",
  };

  solveResponse(url, params);
}

async function editWork(self, event) {
  event.stopPropagation();
  const fromId = self.getAttribute("data-id");
  const name = self.getAttribute("data-name");
  const content =
    addTextBox("tag", fromId) +
    addTextBox("译", name) +
    addInfo("fromId", fromId);
  addPopUpWindow(
    content,
    editWorkSubmit,
    "编辑作品",
    '<i class="fa-solid fa-pen-to-square"></i>',
    removeWork,
  );
}

// 修改角色
async function removeCharaSubmit(data) {
  const work = data["work"];
  const fromId = data["fromId"];
  const fromName = data["fromName"];

  const url = "/editChara";
  const params = {
    fromId: fromId,
    fromName: fromName,
    type: "remove",
    work: work,
  };

  const response = (
    await (await fetch(u(url, params), { method: "POST" })).text()
  ).split("%");
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function editCharaSubmit(data) {
  const id = data["tag"];
  const name = data["译"];
  const img = data["上传图片"];
  const work = data["work"];
  const fromId = data["fromId"];
  const fromName = data["fromName"];

  const form = new FormData();
  if (img) {
    if (img.size > 5 * 1024 * 1024) {
      createMessage("图片大小不可超过5MB", 3, "bad");
      return;
    }
  }
  form.append("image", img || "");

  const url = "/editChara";
  const params = {
    id: id,
    name: name,
    work: work,
    type: "edit",
    fromId: fromId,
    fromName: fromName,
  };

  const response = (
    await (
      await fetch(u(url, params), {
        method: "POST",
        body: form,
      })
    ).text()
  ).split("%");
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function editChara(self, event) {
  event.stopPropagation();
  const work = document
    .getElementById("prompt-content")
    .getAttribute("data-work");
  if (!work) {
    createMessage("请选择分类", 5, "bad");
    return;
  }

  const c = self.parentElement;
  const en = c.getAttribute("data-en");
  const zh = c.getAttribute("data-zh");
  const img = self.parentElement.getAttribute("data-img");

  const content =
    addTextBox("tag", en) +
    addTextBox("译", zh) +
    addFileIuput("上传图片", "image/*", img) +
    addInfo("work", work) +
    addInfo("fromId", en) +
    addInfo("fromName", zh);
  addPopUpWindow(
    content,
    editCharaSubmit,
    "修改角色",
    '<i class="fa-solid fa-circle-user"></i>',
    removeCharaSubmit,
  );
}

///////////////////////////////////////////////////////////
// 文件输入处理
///////////////////////////////////////////////////////////

async function fileInputAnime() {
  const fileInput = document.getElementById("file-upload");
  const label = document.querySelector('label[for="file-upload"]');

  if (fileInput && label) {
    fileInput.addEventListener("dragenter", (e) => {
      label.classList.add("drag");
    });

    fileInput.addEventListener("dragover", (e) => {
      label.classList.add("drag");
    });

    fileInput.addEventListener("dragleave", (e) => {
      label.classList.remove("drag");
    });

    fileInput.addEventListener("drop", (e) => {
      label.classList.remove("drag");
      setTimeout(() => {
        fileInfoShow(label);
      }, 50);
    });

    fileInput.addEventListener("change", (e) => {
      setTimeout(() => {
        fileInfoShow(label);
      }, 50);
    });
  }
}

// 清理图片
async function clearFileContent(self) {
  const element =
    self.parentElement.parentElement.querySelector("#file-preview");
  const fileUpload = document.getElementById("file-upload");
  self.parentElement.parentElement.querySelector("p").innerText = "上传图片";

  element.classList.remove("fade-in");
  setTimeout(() => {
    element.setAttribute("src", "");
  }, 300);
  fileUpload.files = new DataTransfer().files;
}

// 生成图片缩略图
async function fileInfoShow(label) {
  const fileUpload = document.getElementById("file-upload");
  const textShow = label.querySelector("p");
  label.querySelector("i").classList.add("hidden");
  const file = fileUpload.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    createMessage("只能上传图片", 4, "bad");
    fileUpload.files = new DataTransfer().files;
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    createMessage("图片不可超过5MB", 3, "bad");
    return;
  }
  const img = new FileReader();
  img.onloadend = () => {
    document.getElementById("file-preview").setAttribute("src", img.result);
  };
  document.getElementById("file-preview").classList.remove("fade-in");
  setTimeout(() => {
    img.readAsDataURL(file);
    document.getElementById("file-preview").classList.add("fade-in");
  }, 300);

  // console.log(fileName)
  textShow.innerText = file.name;
}

///////////////////////////////////////////////////////////
// 初始化函数
///////////////////////////////////////////////////////////

const deBug = true;

async function init() {
  renderCategories();
  renderWorks();

  const cartSort = {
    group: "cart",
    animation: 300,
    ghostClass: "sortable-ghost",
    dragClass: "sortable-drag",
    onSort: (evt) => {
      reloadCeil();
    },
    onEnd: (evt) => {
      reloadCeil();
    },
  };

  const cartPositive = document.getElementById("cart-positive");
  const cartNegative = document.getElementById("cart-negative");

  new Sortable(cartPositive, cartSort);
  new Sortable(cartNegative, cartSort);

  const observerPositive = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        localStorage.setItem(
          "positive",
          document.getElementById("cart-positive").innerHTML,
        );
        break;
      }
    }
  });

    const observerNeagtive = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        localStorage.setItem(
          "negative",
          document.getElementById("cart-negative").innerHTML,
        );
        break;
      }
    }
  });

  const observerOption = {
    childList: true, // 监听子节点的添加或移除
    subtree: false, // 监听后代节点
    attributes: false, // 监听属性变化
    characterData: true, // 监听文本内容变化
  }

  observerPositive.observe(cartPositive, observerOption);
  observerNeagtive.observe(cartNegative, observerOption);

  if (!localStorage.getItem('copySelect')) {
    localStorage.setItem('copySelect', {
      underlineInput: false,
      escapeInput: false
    })
  }

  document.getElementById('underline-input').addEventListener('change', (self) => {
    let n = localStorage.getItem('copySelect');
    n.underlineInput = self.checked;
    localStorage.setItem('copySelect', n)
  })

  document.getElementById('escape-input').addEventListener('change', (self) => {
    let n = localStorage.getItem('copySelect');
    n.escapeInput = self.checked;
    localStorage.setItem('copySelect', n)
  })

  const input = document.getElementById("search-box");

  input.addEventListener(
    "input",
    debounce(() => {
      let value = input.value.trim();
      if (value) {
        searchSend(value);
        document.getElementById("divider").classList.add("show");
      } else {
        document.getElementById("prompt-search-content").innerHTML = "";
        document.getElementById("divider").classList.remove("show");
        reloadPromptCount();
      }
    }, 1000),
  );
  input.addEventListener("keydown", (e) => {
    const value = input.value.trim();
    if (e.key == "Enter" && value) {
      searchSend(value);
    }
  });

  // setInterval(getStatus, 1000);
  createMessage("左/右 键提示词卡片以添加至 正/负 购物车");
}

// 确保 DOM 加载完成后再执行
document.addEventListener("DOMContentLoaded", init);

// 在页面加载时读取并恢复
window.addEventListener("load", () => {
  document.getElementById("cart-positive").innerHTML =
    localStorage.getItem("positive");
  document.getElementById("cart-negative").innerHTML =
    localStorage.getItem("negative");

  Array.from(document.getElementById("cart-negative").children).map((card) => {
    card.classList.add("active");
  });
  Array.from(document.getElementById("cart-positive").children).map((card) => {
    card.classList.add("active");
  });

  let selecter = localStorage.getItem('copySelect');
  document.getElementById('underline-input').checked = selecter.underlineInput;
  document.getElementById('escape-input').checked = selecter.escapeInput;
});
