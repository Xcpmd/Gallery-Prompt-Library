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
  return hash.toString(16).padStart(16, '0').replace(/-/g, "_");
}

// 生成url
function u(url, params={}) {
  return `${url}?${new URLSearchParams(params)}`
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
  data.map(t => {
    idAndZh[t[0]] = t[1];
  })
  let Ids = data.map((d) => {return d[0].trim()})
  Array.from(element.children).map((card) => {
    let id = card.id.split('-')[2];
    if (Ids.includes(id)) {
        let clonedCard = card.cloneNode(true);
        let target = clonedCard.children[0].children[0].children[1];
        if (target) {
            target.innerText = idAndZh[id];
        }
        
        exist[id] = clonedCard.outerHTML;
    };
  })

  let htmlString = "";
  // 渲染内容
  data.map((title) => {
    category = title[0].trim();
    nameZh = title[1].trim();

    let template = exist[category] || /* html */ `
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

// 渲染分类子项
async function categoryContent(category, reflash=false) {
  const element = document.getElementById(`category-inner-${category}`);;
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
    };
  });
  // 渲染
  let htmlString = "";
  data.map((key) => {
    // if (!existKey.includes(`key-${vaid(category)}-${vaid(key)}`)) {
    let title = key;
    if (key == "default") title = "默认";

    let template = existKey[key] || /* html */ `
      <div id="key-${vaid(category)}-${vaid(key)}" class="category-key" name="${key}" onclick="renderPrompts(this, '${category}', '${key}')">
        <p>${title}</p>
        <div class="icon child-edit-btn" data-id="${category}-${key}" onclick="editChildCategory(event, this)">
          <i class="fa-solid fa-pen-to-square"></i>
        </div>
      </div>`;
    htmlString += template;
  });
  // 添加子分类按钮
  htmlString += /* html*/ `
        <div id="key-${vaid(category)}-add-btn" class="category-key" onclick="addChildCategory('${category}')">
          <i class="fa-solid fa-plus"></i>
        </div>`
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
    htmlString += '<p>未搜索到内容</p>'
  }
  cards.map((singlePrompt) => {
    let en = singlePrompt[0].trim();
    let zh = singlePrompt[1].trim();
    let r = singlePrompt[2];

    let target = document.getElementById(`cart-in-${vaid(en+zh)}`);
    let inPosi = cartPositive.contains(target);
    let inNega = cartNegative.contains(target);

    let active = "";
    if (inPosi) {
      active = " positive";
    } else if (inNega) {
      active = " negative";
    }

    let exist = element.querySelector(`#prompt-ceil-${vaid(en+zh)}`)?.outerHTML;

    let template = exist || /* html */ `
      <div class='prompt-ceil${active}' id="prompt-ceil-${vaid(en+zh)}" data-r="${r}" onclick='addPositiveCart(this)'>
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
async function renderPrompts(self, category, key, immediately=false) {
  const url = `/prompt/`;
  const params = {
    category: category,
    key: key,
    nsfw: nsfw
  }
  // console.log(url)
  const element = document.getElementById("prompt-content");
  document.querySelectorAll(".category-key").forEach((option) => {
    option.classList.remove("active");
  });
  self.classList?.add("active");
  
  element.setAttribute("data-page", `${category}-${key}`);
  const response = await fetch(u(url, params));
  let data = await response.json();

  //渲染卡片
  renderCard(element, data, immediately=immediately);
}

//添加至购物车: 正面
async function addPositiveCart(card) {
  const element = document.getElementById("cart-positive");

  const cartNegative = document.getElementById("cart-negative");

  let en = card.querySelector(".en").innerText;
  let zh = card.querySelector(".zh").innerText;

  let inCart = element.querySelector(`#cart-in-${vaid(en+zh)}`);
  let inNega = cartNegative.querySelector(`#cart-in-${vaid(en+zh)}`);
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
        <div id='cart-in-${vaid(en+zh)}' class='in-cart'>
          <div class="content">
            <p class='e'>${en}</p>
            <p class='z'>${zh}</p>
          </div>
          <div class="prompt-ceil-rm-btn" onclick='removePrompt(this)'>
            <i class="fa-solid fa-xmark"></i>
          </div>
        </div>`;

    element.innerHTML += template;
    setTimeout(() => {
      element.querySelector(`#cart-in-${vaid(en+zh)}`)?.classList.add("active");
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
async function addNegativeCart(card) {
  const element = document.getElementById("cart-negative");

  const cartPositive = document.getElementById("cart-positive");

  let en = card.querySelector(".en").innerText;
  let zh = card.querySelector(".zh").innerText;

  let inCart = element.querySelector(`#cart-in-${vaid(en+zh)}`);
  let inPosi = cartPositive.querySelector(`#cart-in-${vaid(en+zh)}`);
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
          <div id='cart-in-${vaid(en+zh)}' class='in-cart'>
            <div class="content">
              <p class='e'>${en}</p>
              <p class='z'>${zh}</p>
            </div>
            <div class="prompt-ceil-rm-btn" onclick='removePrompt(this)'>
              <i class="fa-solid fa-xmark"></i>
            </div>
          </div>`;

    element.innerHTML += template;
    setTimeout(() => {
      element.querySelector(`#cart-in-${vaid(en+zh)}`)?.classList.add("active");
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

//复制
function copy(btn) {
  let element = btn.parentElement.parentElement.parentElement.querySelector(".cart");
  let result = [];

  const underline = document.getElementById("underline-input").checked;
  const escaping = document.getElementById("escape-input").checked;
  const resultShower = document.getElementById("copy-result");
  const showerContent = document.getElementById("copy-result-shower");

  element.querySelectorAll(".in-cart").forEach((card) => {
    tag = card.querySelector(".content").querySelector(".e").innerText;
    let p = escaping ? tag.replace(/\(|\)/g, "\\$&") : tag;
    result.push(p);
  });
  result = result.join(", ");
  let content = underline ? result.replace(/_/g, " ") : result;

  navigator.clipboard.writeText(content);

  if (result) {
    showerContent.classList.remove("active");
    setTimeout(() => {
      resultShower.innerText = content;
      showerContent.classList.add("active");
    }, 300)
  }else{
    createMessage("空内容", 3)
  }
  console.log(content);
}

var warnAtt = {
  positive: false,
  negative: false,
};

//清空购物车
function clearCart(btn) {
  let element =
    btn.parentElement.parentElement.parentElement.querySelector(".cart");
  let type = btn.getAttribute("name");
  reloadCeil();

  if (!warnAtt[type]) {
    btn.classList.add("active");
    warnAtt[type] = true;
    id = setTimeout(() => {
      warnAtt[type] = false;
      btn.classList.remove("active");
    }, 5000);
  } else {
    btn.classList.remove("active");
    Array.from(element.children).map((card) => {
      removePrompt(card.querySelector(".prompt-ceil-rm-btn"));
    });
    warnAtt[type] = false;
  }
}

//从购物车移除单个prompt
function removePrompt(tag) {
  const cardContent = tag.parentElement.children[0];
  const en = cardContent.children[0].innerText;
  const zh = cardContent.children[1].innerText

  document
    .getElementById(`prompt-ceil-${vaid(en+zh)}`)?.classList.remove("positive", "negative");

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
    createMessage("新世界!", 3, "good")
  } else {
    btnIcon.remove("fa-check");
    btnIcon.add("fa-ban");
  }

  reflash(true);
}

// 刷新内容
async function reflash(immediately=false) {
  const input = document.getElementById("search-box");
  
  let value = input.value.trim();
  if (value) searchSend(value);
  
  renderCategories();
  reloadCeil();
  const dataNow = document
  .getElementById("prompt-content")
    .getAttribute("data-page")
    .split("-");

  if (dataNow.length > 1) {
    const category = dataNow[0];
    const key = dataNow[1];
    const element = document.getElementById(`key-${vaid(category)}-${vaid(key)}`);
    renderPrompts(element, category, key, immediately=immediately);
  }
  reloadPromptCount();
}

async function reloadPromptCount() {
  const defaultPrompt = document.getElementById("prompt-content");
  const searchPrompt = document.getElementById("prompt-search-content");
  const statusPromptCount = document.getElementById("prompt-load-count");

  const value = defaultPrompt.getElementsByClassName('prompt-ceil').length + searchPrompt.getElementsByClassName('prompt-ceil').length;
  
  statusPromptCount.innerText = `已加载${value}个prompt`;
}

// 刷新卡片状态
async function reloadCeil() {
  const cartPositive = document.getElementById("cart-positive");
  const cartNegative = document.getElementById("cart-negative");

  Array.from(document.getElementsByClassName("prompt-ceil")).map((self) => {
    let en = self.children[0].children[0].innerText;
    let zh = self.children[0].children[1].innerText;

    let target = document.getElementById(`cart-in-${vaid(en+zh)}`);
    let inPosi = cartPositive.contains(target);
    let inNega = cartNegative.contains(target);

    if (inPosi) {
      self.classList.add("positive");
    } else if (inNega) {
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
async function createMessage(text, time=5, level="normal") {
  const element = document.getElementById("message-box");
  messageIndex++;
  // 默认图标 (i)
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (text.length > 16) {
    text.slice(0,15)
    text += "..."
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
  </div>`

  element.insertAdjacentHTML('beforeend', template);
  // 添加动画
  setTimeout(() => {
    let message = element.querySelector(`#message-${vaid(text)}-${messageIndex}`);
    message.classList.add("fade-in");
    element.querySelector(`#message-line-${vaid(text)}-${messageIndex}`).classList.add("active");
    setTimeout(() => {
      message.classList.remove("fade-in");
      setTimeout(() => {
        message.remove();
      }, 300)
    }, time * 1000);
  }, 50)
}

///////////////////////////////////////////////////////////
// 提示词编辑函数
///////////////////////////////////////////////////////////

// 新建弹窗
async function addPopUpWindow(content, submit, title="Title", icon='<i class="fa-solid fa-circle-info"></i>', removeBtn=null) {
  const windowContainer = document.getElementById("pop-up");
  windowContainer.classList.add("active");

  // 存储回调函数到全局
  window.__popupSubmitCallback = submit;
  window.__popupRemoveCallback = removeBtn;
  const remove = removeBtn ? /* html */ `
      <div id="pop-up-remove-btn" class="clear-btn pop-up-remove-btn" onclick="popUpSubmit(true)">
        <i class="fa-solid fa-trash"></i>
      </div>` : '';

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
  }, 50);
}

//关闭弹窗
async function closePopUpWindow() {
  const windowContainer = document.getElementById("pop-up");
  
  windowContainer.querySelector("#pop-up-box").classList.remove("fade-in")
  windowContainer.classList.remove("active");
  setTimeout(() => {
    windowContainer.innerHTML = "";
  }, 200)
}

/////////
// 弹窗模块

// 文本框
function addTextBox(title, defaultText="") {
  return /* html */ `
  <div class="pop-up-text-box">
    <p class="pop-up-input-title">${title}</p>
    <input type="text" id="pop-up-text-${title}" class="pop-up-input-box" name="${title}" placeholder="${defaultText}">
  </div>`
}

function addInfo(id, info) {
  return /*html*/ `
  <input type="text" class="pop-up-input-info" name="${id}" placeholder="${info}">`
}

function addBtn(title, turnOn=false) {
  return /*html*/`
  <div class="pop-up-checkbox-box">
    <p class="pop-up-input-title">${title}<p>
    <label class="select-box">
      <input type="checkbox" name="${title}" name="${title}"${turnOn ? " checked" : ""}>
      <span class="select-slider"></span>
    </label>
  </div>`
}

// 按钮触发
function popUpSubmit(remove=false) {
  const form = document.getElementById("pop-up-content");
  let result = {};
  Array.from(form.getElementsByTagName("input")).map(self => {
    const name = self.getAttribute("name");
    switch (self.getAttribute("type")) {
      case "text":
        const value = self.value.trim() || self.getAttribute("placeholder");
        result[name] = value;
        return;
      case "checkbox":
        result[name] = self.checked ? 1 : 0;
        return;
    }
  });

  // 调用存储的回调并传入数据
  if (typeof window.__popupSubmitCallback === 'function' || typeof window.__popupRemoveCallback === 'function') {
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
        }, 3000)
      }

    }else{
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

  if (!id || !name) {
    createMessage("内容不能为空", 5, "bad");
    return;
  }

  const url = '/editCategory';
  const params ={
    "id": id,
    "name": name,
    "type" : "add",
  };
  
  const response = await (await fetch(u(url, params))).text()
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

//新建分类
async function addCategory() {
  const content = addTextBox("ID") + addTextBox("翻译");
  addPopUpWindow(content, addCategorySubmit, "添加分类", '<i class="fa-solid fa-bookmark"></i>')
}
//////////

// 修改分类

async function removeCategorySubmit(data) {
  const fromId = data["fromid"];

  console.log(fromId)
  const url = '/editCategory'
  const params = {
    id: fromId,
    type: "remove",
  }

  const response = (await (await fetch(u(url, params))).text()).split('%');
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function editCategorySubmit(data) {
  const id = data["ID"];
  const name = data["翻译"];
  const fromId = data["fromid"];

  if (!id || !name) {
    createMessage("内容不能为空", 5, "bad");
    return;
  }

  console.log(fromId, id, name)
  const url = '/editCategory'
  const params = {
    id: id,
    name: name,
    type: "edit",
    fromId: fromId
  }

  const response = (await (await fetch(u(url, params))).text()).split('%');
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function editCategory(event, self) {
  event.stopPropagation();
  const idAndZh = self.getAttribute("data-id").split('-');
  const id = idAndZh[0];
  const name = idAndZh[1];

  const content = addTextBox("ID", id) + addTextBox("翻译", name) + addInfo("fromid", id);
  addPopUpWindow(content, editCategorySubmit, `修改${name}`, '<i class="fa-solid fa-pen-to-square"></i>', removeCategorySubmit)
}

// 添加子分类

async function addChildCategorySubmit(data) {
  const nsfw = data["NSFW?"];
  const name = data["名称"];
  const category = data["category"]
  if (name) {
    const url = `/editChildCategory/${category}`
    const params = {
      name: name,
      type: "add",
      nsfw: nsfw,
    }

    const response = (await (await fetch(u(url, params))).text()).split('%');
    const text = response[0];
    const level = response[1];
    createMessage(text, 3, level)
  }else createMessage("请输入有效名称", 5, "bad")
}

async function addChildCategory(category) {
  const content = addTextBox("名称") + addBtn("NSFW?") + addInfo("category", category);
  addPopUpWindow(content, addChildCategorySubmit, "添加子分类", '<i class="fa-regular fa-bookmark"></i>')
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

  console.log(category, fromName, name)
  const url = `/editChildCategory/${category}`
  const params = {
    name: name,
    from: fromName,
    type: "edit"
  }

  const response = (await (await fetch(u(url, params))).text()).split('%');
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function removeChildCategorySubmit(data) {
  const fromName = data["fromName"];

  console.log(category, fromName)
  const url = `/editChildCategory/${category}`
  const params = {
    name: fromName,
    type: "remove"
  }

  const response = (await (await fetch(u(url, params))).text()).split('%');
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function editChildCategory(event, self) {
  event.stopPropagation();
  const idAndZh = self.getAttribute("data-id").split('-');
  const category = idAndZh[0];
  const name = idAndZh[1];

  const content = addTextBox("名称", name) + addInfo("fromName", name) + addInfo("category", category);
  addPopUpWindow(content, editChildCategorySubmit, `修改${name}`, '<i class="fa-solid fa-pen-to-square"></i>', removeChildCategorySubmit)
}

// 添加提示词

async function addPromptSubmit(data) {
  const en = data["英"];
  const zh = data["中"];
  const isNsfw = data["NSFW?"];
  const category = data["category"];
  const key = data["key"]

  const url = '/editPrompt';
  const params = {
    en: en,
    zh: zh,
    nsfw: isNsfw,
    category: category,
    key: key,
    type: "add"
  }

  const response = (await (await fetch(u(url, params))).text()).split('%');
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function addPrompt() {
  const idAndZh = document.getElementById("prompt-content").getAttribute("data-page").split('-');
  if (idAndZh.length < 2) {
    createMessage("请选择分类", 5, "bad");
    return
  }
  const category = idAndZh[0];
  const name = idAndZh[1];

  const content = addTextBox("英") + addTextBox("中") + addBtn("NSFW?", false) + addInfo("category", category) + addInfo("key", name)
  addPopUpWindow(content, addPromptSubmit, "添加提示词", '<i class="fa-solid fa-tag"></i>');
} 

async function removePromptSubmit(data) {
  const fromNSFW = data["FromNSFW"]
  const category = data["category"];
  const key = data["key"];
  const fromEn = data["fromEn"];
  const fromZh = data["fromZh"];

  const url = '/editPrompt'
  const params = {
    fromEn: fromEn,
    fromZh: fromZh,
    fromNSFW: fromNSFW == 'true' ? 1 : 0,
    category: category,
    key: key,
    type: "remove"
  }

  const response = (await (await fetch(u(url, params))).text()).split('%');
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function editPromptSubmit(data) {
  const en = data["英"];
  const zh = data["中"];
  const isNsfw = data["NSFW?"];
  const fromNSFW = data["FromNSFW"];
  const category = data["category"];
  const key = data["key"];
  const fromEn = data["fromEn"];
  const fromZh = data["fromZh"];

  const url = '/editPrompt'
  const params = {
    fromEn: fromEn,
    fromZh: fromZh,
    fromNSFW: fromNSFW == 'true' ? 1 : 0,
    en: en,
    zh: zh,
    nsfw: isNsfw,
    category: category,
    key: key,
    type: "edit"
  }

  const response = (await (await fetch(u(url, params))).text()).split('%');
  const text = response[0];
  const level = response[1];
  createMessage(text, 3, level);
}

async function editPrompt(event, self) {
  event.stopPropagation();
    const idAndZh = document.getElementById("prompt-content").getAttribute("data-page").split('-');
  if (idAndZh.length < 2) {
    createMessage("请选择分类", 5, "bad");
    return
  }
  const category = idAndZh[0];
  const name = idAndZh[1];
  const c = self.parentElement.children[0];
  const en = c.children[0].innerText;
  const zh = c.children[1].innerText;
  const r = self.getAttribute("data-r") == 1;

  const content = 
    addTextBox("英", en) + 
    addTextBox("中", zh) + 
    addBtn("NSFW?", r) + 
    addInfo("FromNSFW", r) + 
    addInfo("category", category) + 
    addInfo("key", name) +
    addInfo("fromEn", en) +
    addInfo("fromZh", zh);
  addPopUpWindow(content, editPromptSubmit, "修改提示词", '<i class="fa-solid fa-tag"></i>',removePromptSubmit)
}

///////////////////////////////////////////////////////////
// 初始化函数
///////////////////////////////////////////////////////////

const deBug = true;

async function init() {
  renderCategories();
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
    }, 2000),
  );
  
  setInterval(getStatus, 1000);
  createMessage("左/右 键提示词卡片以添加至 正/负 购物车")
}

// 确保 DOM 加载完成后再执行
document.addEventListener("DOMContentLoaded", init);
