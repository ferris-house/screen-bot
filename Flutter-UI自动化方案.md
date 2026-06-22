# Flutter 自绘应用 UI 自动化方案

## 问题背景

企业微信采用 **Flutter 全自绘架构**，使用 Skia 渲染引擎绘制所有 UI 元素。这意味着：

- ❌ 无法通过 Windows UI Automation API 获取控件信息
- ❌ pywinauto、node-uiautomation 等传统工具完全失效
- ❌ 所有控件在 Windows 系统层面是"透明的"

**类比场景**：类似识别游戏 UI、DirectX/OpenGL 渲染的应用。

---

## 方案对比

| 方案 | 适用场景 | 速度 | 精度 | 复杂度 | 推荐度 |
|------|---------|------|------|--------|--------|
| OCR + 坐标定位 | 动态文字内容识别 | 2-5秒 | 高 | 中 | ⭐⭐⭐⭐⭐ |
| 模板匹配 | 固定 UI 元素（按钮、图标） | 0.3秒 | 高 | 低 | ⭐⭐⭐⭐ |
| OpenCV 边缘检测 | 动态 UI 元素（输入框、头像） | 0.5秒 | 中 | 高 | ⭐⭐⭐ |
| Accessibility Tree | Flutter 特殊情况 | 毫秒级 | 依赖实现 | 低 | ⭐⭐⭐ |
| 计算机视觉 + ML | 复杂 UI 结构识别 | 1秒 | 最高 | 很高 | ⭐⭐ |

---

## 方案详解

### 方案 1：OCR + 坐标定位（推荐用于文字识别）

#### 原理
1. 截取窗口截图
2. OCR 识别文字内容
3. 获取文字的精确坐标
4. 基于坐标进行点击操作

#### 适用场景
- ✅ 识别聊天消息内容
- ✅ 定位文字按钮（如"发送"、"取消"）
- ✅ 识别动态变化的文字信息

#### 代码示例

```typescript
import { desktopCapturer, nativeImage } from 'electron';
import Tesseract from 'tesseract.js';
import robot from 'robotjs';

/**
 * 通过 OCR 找到目标文字并点击
 */
async function findAndClickText(targetText: string): Promise<void> {
  // 1. 截取企业微信窗口
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  const wechat = sources.find(s => s.name.includes('企业微信'));

  if (!wechat) {
    throw new Error('未找到企业微信窗口');
  }

  // 2. OCR 识别，获取每个词的坐标
  const result = await Tesseract.recognize(
    wechat.thumbnail.toDataURL(),
    'chi_sim+eng',
    {
      logger: (m) => console.log(`OCR进度: ${m.status} - ${Math.round(m.progress * 100)}%`)
    }
  );

  // result.data.words 是数组，每个元素包含：
  // - text: 文字内容
  // - bbox: { x0, y0, x1, y1 } 相对于截图的坐标

  console.log(`识别到 ${result.data.words.length} 个文字单元`);

  // 3. 找目标文字
  const targetWord = result.data.words.find(w =>
    w.text.includes(targetText)
  );

  if (!targetWord) {
    throw new Error(`未找到文字: ${targetText}`);
  }

  // 4. 计算点击坐标
  // OCR 给的是相对于截图的坐标，需要加上窗口的实际位置
  const windowBounds = getWindowBounds(); // 从 node-window-manager 获取
  const clickX = windowBounds.x + (targetWord.bbox.x0 + targetWord.bbox.x1) / 2;
  const clickY = windowBounds.y + (targetWord.bbox.y0 + targetWord.bbox.y1) / 2;

  console.log(`点击坐标: (${clickX}, ${clickY})`);

  // 5. 执行点击
  robot.moveMouse(clickX, clickY);
  robot.mouseClick();
}

/**
 * 识别所有聊天消息
 */
async function recognizeAllMessages(): Promise<Message[]> {
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  const wechat = sources.find(s => s.name.includes('企业微信'));

  const result = await Tesseract.recognize(
    wechat.thumbnail.toDataURL(),
    'chi_sim+eng'
  );

  // 解析消息结构（需要根据 UI 布局规则解析）
  return parseMessages(result.data.words);
}

interface Message {
  text: string;
  position: { x: number; y: number };
  timestamp?: string;
}
```

#### 优缺点
- **优点**：能识别动态文字内容、获取精确坐标、不依赖控件 API
- **缺点**：速度慢（2-5秒）、需要频繁截图、中英文混合时精度略降

#### 性能优化建议
- 使用 PaddleOCR（中文识别更快更准）
- 只截取需要的区域（如只截消息列表区域）
- 缓存识别结果（相同内容不重复识别）

---

### 方案 2：模板匹配（推荐用于固定 UI 元素）

#### 原理
1. 准备 UI 元素的截图模板
2. 在窗口截图中进行相似度匹配
3. 找到最佳匹配位置的坐标

#### 适用场景
- ✅ 找固定按钮（发送、取消、设置等）
- ✅ 找固定图标（头像、表情等）
- ✅ UI 元素位置相对不变的场景

#### 代码示例

```typescript
import Jimp from 'jimp';
import { desktopCapturer } from 'electron';

/**
 * 模板匹配：在窗口中查找目标图片的位置
 */
async function findTemplate(
  templateImagePath: string,
  threshold: number = 0.8
): Promise<{ x: number; y: number; score: number } | null> {
  // 1. 加载模板图片
  const template = await Jimp.read(templateImagePath);

  // 2. 截取当前窗口
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  const wechat = sources.find(s => s.name.includes('企业微信'));

  if (!wechat) {
    throw new Error('未找到企业微信窗口');
  }

  const screenshot = await Jimp.read(wechat.thumbnail.toDataURL());

  // 3. 模板匹配
  const result = await findTemplateInImage(screenshot, template);

  if (result.score > threshold) {
    // 转换为屏幕坐标
    const windowBounds = getWindowBounds();
    return {
      x: windowBounds.x + result.x,
      y: windowBounds.y + result.y,
      score: result.score
    };
  }

  return null;
}

/**
 * 在大图中查找小图的位置
 */
async function findTemplateInImage(
  source: Jimp,
  template: Jimp
): Promise<{ x: number; y: number; score: number }> {
  const sourceWidth = source.getWidth();
  const sourceHeight = source.getHeight();
  const templateWidth = template.getWidth();
  const templateHeight = template.getHeight();

  let bestMatch = { x: 0, y: 0, score: 0 };

  // 遍历所有可能的位置
  for (let y = 0; y < sourceHeight - templateHeight; y += 5) {
    for (let x = 0; x < sourceWidth - templateWidth; x += 5) {
      // 计算相似度
      const score = calculateSimilarity(source, template, x, y);

      if (score > bestMatch.score) {
        bestMatch = { x, y, score };
      }
    }
  }

  return bestMatch;
}

/**
 * 计算两个区域的相似度
 */
function calculateSimilarity(
  source: Jimp,
  template: Jimp,
  offsetX: number,
  offsetY: number
): number {
  let sum = 0;
  const width = template.getWidth();
  const height = template.getHeight();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceColor = source.getPixelColor(offsetX + x, offsetY + y);
      const templateColor = template.getPixelColor(x, y);

      // 计算颜色差异
      const diff = Math.abs(sourceColor - templateColor) / 0xFFFFFFFF;
      sum += 1 - diff;
    }
  }

  return sum / (width * height);
}

/**
 * 使用示例
 */
async function clickSendButton(): Promise<void> {
  // 准备"发送"按钮的模板图片（需要提前截取保存）
  const sendButton = await findTemplate('assets/templates/send_button.png');

  if (sendButton) {
    console.log(`找到发送按钮，匹配度: ${sendButton.score}`);
    robot.moveMouse(sendButton.x + 20, sendButton.y + 10);
    robot.mouseClick();
  } else {
    throw new Error('未找到发送按钮');
  }
}

/**
 * 找用户的头像
 */
async function clickUserAvatar(userName: string): Promise<void> {
  // 每个用户需要提前准备头像模板
  const avatar = await findTemplate(`assets/avatars/${userName}.png`, 0.7);

  if (avatar) {
    robot.moveMouse(avatar.x, avatar.y);
    robot.mouseClick();
  }
}
```

#### 优缺点
- **优点**：速度快（0.3秒）、精度高、适合固定元素
- **缺点**：需要提前准备模板图片、UI 变化时需要更新模板

#### 模板准备建议
- 截取清晰的 UI 元素图片
- 避免截取动态变化的区域（如动画）
- 保持模板尺寸适中（20x20 到 100x100）

---

### 方案 3：OpenCV 边缘检测（用于动态 UI 元素）

#### 原理
1. 截取窗口截图
2. 使用 OpenCV 进行图像处理
3. 通过边缘检测、轮廓识别找到 UI 元素

#### 适用场景
- ✅ 找矩形输入框、聊天区域
- ✅ 找圆形头像、图标
- ✅ UI 结构识别（布局分析）

#### 代码示例

```typescript
import cv from '@techstark/opencv-js';

/**
 * 使用 OpenCV 找输入框（矩形）
 */
async function findInputBox(): Promise<{ x: number; y: number; width: number; height: number }> {
  // 1. 截取窗口
  const screenshot = await captureWindow();

  // 2. 转换为 OpenCV Mat
  const mat = cv.imread(screenshot);

  // 3. 转灰度图
  const gray = new cv.Mat();
  cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

  // 4. 边缘检测
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);

  // 5. 找轮廓
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  // 6. 筛选可能是输入框的矩形
  const inputBox = findLikelyInputBox(contours);

  // 清理内存
  mat.delete();
  gray.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();

  return inputBox;
}

/**
 * 筛选符合条件的矩形
 */
function findLikelyInputBox(contours: cv.MatVector): Rectangle {
  const candidates: Rectangle[] = [];

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);

    // 计算轮廓面积
    const area = cv.contourArea(contour);

    // 筛选面积范围（输入框通常在某个范围内）
    if (area > 5000 && area < 50000) {
      // 计算轮廓的矩形边界
      const rect = cv.boundingRect(contour);

      // 检查长宽比（输入框通常是长条形）
      const aspectRatio = rect.width / rect.height;

      if (aspectRatio > 3 && aspectRatio < 20) {
        candidates.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        });
      }
    }

    contour.delete();
  }

  // 返回最符合条件的矩形（如位置最低的）
  return candidates.sort((a, b) => b.y - a.y)[0];
}

/**
 * 找圆形头像
 */
async function findCircularAvatars(): Promise<Circle[]> {
  const screenshot = await captureWindow();
  const mat = cv.imread(screenshot);
  const gray = new cv.Mat();
  cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

  // 使用霍夫圆检测
  const circles = new cv.Mat();
  cv.HoughCircles(
    gray,
    circles,
    cv.HOUGH_GRADIENT,
    1,
    20,  // 圆心之间的最小距离
    50,  // 边缘检测高阈值
    30,  // 圆检测阈值
    20,  // 最小半径
      40   // 最大半径
  );

  const results: Circle[] = [];
  for (let i = 0; i < circles.cols; i++) {
    const x = circles.data32F[i * 3];
    const y = circles.data32F[i * 3 + 1];
    const r = circles.data32F[i * 3 + 2];

    results.push({ x, y, radius: r });
  }

  mat.delete();
  gray.delete();
  circles.delete();

  return results;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Circle {
  x: number;
  y: number;
  radius: number;
}
```

#### 优缺点
- **优点**：能找动态 UI 元素、不依赖模板、适合布局分析
- **缺点**：复杂度高、需要调参、可能误识别

---

### 方案 4：Accessibility Tree 验证（可能可行）

#### 原理
Flutter 应用**可能**会提供部分 Accessibility 信息（用于盲人用户），需要验证是否可用。

#### 验证方法

**Python 测试脚本**：
```python
from pywinauto import Application
import json

# 连接企业微信
app = Application(backend="uia").connect(title="企业微信")
window = app.window(title="企业微信")

# 打印控件树结构
def print_control_tree(ctrl, depth=0):
    indent = "  " * depth
    info = {
        "text": ctrl.window_text(),
        "class": ctrl.class_name(),
        "type": ctrl.element_info.control_type,
        "rect": str(ctrl.rectangle())
    }
    print(f"{indent}{json.dumps(info, ensure_ascii=False)}")

    for child in ctrl.children():
        print_control_tree(child, depth + 1)

# 执行验证
print_control_tree(window)
```

**Electron 中调用**：
```typescript
import { spawn } from 'child_process';

async function checkAccessibility(): Promise<any> {
  const python = spawn('python', ['scripts/check_wechat_a11y.py']);

  let output = '';
  python.stdout.on('data', (data) => {
    output += data.toString();
  });

  await new Promise((resolve) => python.on('close', resolve));

  console.log('Accessibility 信息:');
  console.log(output);

  return parseAccessibilityInfo(output);
}
```

#### 如果可用
如果能获取到部分信息，结合其他方案使用：
```
优先用 Accessibility Tree（速度快）
↓
如果获取不到 → 用 OCR（文字）
↓
如果还是找不到 → 用模板匹配（图标）
```

---

### 方案 5：计算机视觉 + ML（最先进但复杂）

#### 原理
使用深度学习模型识别 UI 元素类型和位置。

#### 技术栈
- **YOLO** - 目标检测模型
- **TensorFlow.js** - Node.js 中运行模型
- **自定义训练** - 针对企业微信 UI 训练模型

#### 适用场景
- ✅ 复杂 UI 结构识别
- ✅ 动态变化的多类型元素
- ✅ 需要理解 UI语义（如"这是输入框"、"这是发送按钮"）

#### 代码示例

```typescript
import * as tf from '@tensorflow/tfjs-node';

/**
 * 加载预训练的 UI 元素检测模型
 */
async function loadUIModel(): Promise<tf.GraphModel> {
  const model = await tf.loadGraphModel('file://./models/wechat_ui_model/model.json');
  return model;
}

/**
 * 检测 UI 元素
 */
async function detectUIElements(screenshot: Buffer): Promise<UIElement[]> {
  const model = await loadUIModel();

  // 1. 处理图片
  const image = tf.node.decodeImage(screenshot);
  const input = image.resizeBilinear([640, 640]).expandDims(0);

  // 2. 模型推理
  const predictions = await model.predict(input) as tf.Tensor;

  // 3. 解析检测结果
  const elements = parsePredictions(predictions.dataSync());

  // 清理
  image.dispose();
  input.dispose();
  predictions.dispose();

  return elements;
}

/**
 * 解析模型输出
 */
function parsePredictions(data: Float32Array): UIElement[] {
  const elements: UIElement[] = [];

  // 根据 YOLO 输出格式解析
  // 每个检测结果包含：[class, score, x, y, width, height]

  for (let i = 0; i < data.length; i += 6) {
    const classId = data[i];
    const score = data[i + 1];
    const x = data[i + 2];
    const y = data[i + 3];
    const width = data[i + 4];
    const height = data[i + 5];

    if (score > 0.5) { // 阈值过滤
      elements.push({
        type: classNames[classId], // 'input_box', 'send_button', 'avatar', 'message'
        score: score,
        bbox: { x, y, width, height }
      });
    }
  }

  return elements;
}

interface UIElement {
  type: string;
  score: number;
  bbox: { x: number; y: number; width: number; height: number };
}

const classNames = ['input_box', 'send_button', 'avatar', 'message', 'toolbar'];
```

#### 训练模型步骤
1. 收集企业微信 UI 截图（100+ 张不同场景）
2. 标注 UI 元素位置和类型
3. 使用 YOLO 训练工具训练
4. 导出模型供 Node.js 使用

#### 优缺点
- **优点**：精度最高、能理解 UI 语义、适应动态变化
- **缺点**：复杂度很高、需要训练数据、推理速度较慢（约1秒）

---

## 推荐的组合方案

针对企业微信的实际需求，推荐**混合使用多种方案**：

```typescript
class WeChatUIAutomation {
  /**
   * 识别聊天消息内容
   * - 使用 OCR 方案
   */
  async recognizeMessages(): Promise<Message[]> {
    const screenshot = await this.captureWindow();
    const ocrResult = await this.ocrRecognize(screenshot);
    return this.parseMessages(ocrResult);
  }

  /**
   * 找"发送"按钮
   * - 使用模板匹配（固定元素，速度快）
   */
  async findSendButton(): Promise<Position> {
    return await this.templateMatch('assets/templates/send_button.png');
  }

  /**
   * 找输入框
   * - 使用 OpenCV 边缘检测（矩形检测）
   */
  async findInputBox(): Promise<Position> {
    const screenshot = await this.captureWindow();
    return await this.findRectangleByOpenCV(screenshot);
  }

  /**
   * 找用户头像
   * - 使用模板匹配（如果有用户头像缓存）
   * - 或使用 OpenCV 圆形检测
   */
  async findUserAvatar(userName?: string): Promise<Position> {
    if (userName && await this.hasAvatarCache(userName)) {
      return await this.templateMatch(`assets/avatars/${userName}.png`);
    } else {
      const screenshot = await this.captureWindow();
      return await this.findCircleByOpenCV(screenshot);
    }
  }

  /**
   * 点击文字内容
   * - 使用 OCR 定位文字坐标
   */
  async clickText(text: string): Promise<void> {
    const screenshot = await this.captureWindow();
    const ocrResult = await this.ocrRecognize(screenshot);

    const target = ocrResult.words.find(w => w.text.includes(text));
    if (target) {
      const pos = this.calculateWindowPosition(target.bbox);
      robot.moveMouse(pos.x, pos.y);
      robot.mouseClick();
    }
  }

  /**
   * 尝试通过 Accessibility 获取信息
   * - 作为快速优先方案
   */
  async tryAccessibility(): Promise<any | null> {
    try {
      const info = await this.callPythonA11y();
      if (info && info.length > 0) {
        return info; // 如果有信息，优先使用
      }
    } catch (e) {
      console.log('Accessibility 不可用，降级到视觉方案');
    }
    return null;
  }
}
```

### 决策流程

```
需要识别 UI 元素
↓
1. 先尝试 Accessibility Tree（如果可用）
   - 速度快（毫秒级）
   - 不需要截图
↓ (如果失败)
2. 判断元素类型：
   a. 固定元素（按钮、图标）→ 模板匹配（0.3秒）
   b. 文字内容 → OCR（2-5秒）
   c. 动态形状 → OpenCV（0.5秒）
↓ (复杂场景)
3. 使用 ML 模型（最后手段）
```

---

## 实现优先级建议

### 第一阶段：核心功能
1. ✅ **OCR 文字识别** - 实现消息内容读取
2. ✅ **模板匹配** - 找发送按钮、输入框等固定元素

### 第二阶段：增强功能
3. ⭐ **OpenCV 边缘检测** - 找头像、矩形区域
4. ⭐ **Accessibility 验证** - 测试是否可用

### 第三阶段：高级功能
5. 🔬 **ML 模型** - 如果上述方案不够用

---

## 技术选型建议

### OCR 库选择
| 库 | 中文精度 | 速度 | Electron 支持 | 推荐 |
|---|---------|------|---------------|------|
| **PaddleOCR** | ⭐⭐⭐⭐⭐ | 快 | 需 Python | 中英文 |
| **Tesseract.js** | ⭐⭐⭐ | 慢 | 直接支持 | 纯英文 |
| **EasyOCR** | ⭐⭐⭐⭐ | 中 | 需 Python | 多语言 |

### 图像处理库选择
| 库 | 功能 | Electron 支持 | 推荐场景 |
|---|------|---------------|----------|
| **Jimp** | 模板匹配、基础处理 | 直接支持 | 模板匹配 |
| **OpenCV.js** | 边缘检测、轮廓识别 | 需编译 | 复杂图像处理 |
| **Sharp** | 图像缩放、裁剪 | 直接支持 | 预处理 |

---

## 性能对比

| 操作 | OCR | 模板匹配 | OpenCV | ML |
|------|-----|----------|---------|-----|
| 单次识别时间 | 2-5秒 | 0.3秒 | 0.5秒 | 1秒 |
| 内存占用 | 中 | 低 | 高 | 高 |
| 准备工作 | 无 | 需模板 | 无 | 需训练模型 |
| 精度 | 高（文字） | 高（固定） | 中 | 最高 |

---

## 常见问题 FAQ

### Q1: OCR 太慢怎么办？
**解决方案**：
- 使用 PaddleOCR（比 Tesseract 快）
- 只截取需要的区域（不要截整个窗口）
- 缓存识别结果
- 多线程处理（识别多个区域）

### Q2: 模板匹配找不到怎么办？
**解决方案**：
- 降低阈值（从 0.8 到 0.6）
- 更新模板图片（UI 可能变化）
- 检查截图质量（分辨率、模糊）
- 使用多尺度匹配（应对缩放）

### Q3: Flutter UI 变化导致识别失败？
**解决方案**：
- 定期更新模板图片
- 使用更通用的识别方式（如找文字而非找图标）
- ML 模型自动适应变化
- 保存多个版本的模板

### Q4: 如何提高稳定性？
**解决方案**：
- 结合多种方案（交叉验证）
- 添加错误重试机制
- 定期校准窗口位置
- 记录日志用于调试

---

## 参考资源

- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js)
- [OpenCV.js GitHub](https://github.com/techstark/opencv.js)
- [Jimp GitHub](https://github.com/jimp-dev/jimp)
- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
- [Flutter Accessibility](https://docs.flutter.dev/ui/accessibility-and-internationalization/accessibility)
- [YOLO UI Detection](https://github.com/AppliFromParis/YOLO_UI)

---

## 下一步行动

1. **验证 Accessibility Tree** - 运行 Python 脚本测试
2. **实现 OCR 方案** - 安装 Tesseract.js 或调用 PaddleOCR
3. **准备模板图片** - 截取常用按钮、图标
4. **测试模板匹配** - 验证找固定元素的效果

---

**文档版本**: v1.0
**更新日期**: 2024-01-22
**适用场景**: Flutter 自绘应用（企业微信、游戏 UI 等）