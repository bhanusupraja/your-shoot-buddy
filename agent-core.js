(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.CameramanCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TOPIC_TIMEOUT_MS = 8000;
  var ZOOM_IN_LEVEL = 1.7;
  var FILL_ZOOM_MAX = 3.0; // tightest product-only crop; past this a digital crop just gets mushy

  var DEFAULT_INGREDIENTS = [
    'rice',
    'chicken',
    'onion',
    'tomato',
    'yogurt',
    'biryani masala',
    'oil',
    'salt',
    'water'
  ];

  // Recipe spoken keywords: canonical topic -> phrases.
  var RECIPE_KEYWORDS = {
    biryani: ['biryani', 'dish', 'pot', 'handi', 'plate'],
    rice: ['rice', 'basmati'],
    chicken: ['chicken'],
    onion: ['onion'],
    tomato: ['tomato'],
    yogurt: ['yogurt', 'curd', 'dahi'],
    'biryani masala': ['masala', 'spice', 'spices'],
    oil: ['oil', 'ghee'],
    salt: ['salt'],
    water: ['water']
  };

  // Extra produce/ingredients the agent hears as topics (tracked + shown, and
  // "add <item>" promotes any of them onto the checklist).
  var INGREDIENT_TOPICS = {
    cucumber: ['cucumber', 'cucumbers'],
    potato: ['potato', 'potatoes', 'aloo'],
    carrot: ['carrot', 'carrots'],
    capsicum: ['capsicum', 'bell pepper'],
    chilli: ['chilli', 'chillies', 'chili', 'green chilli'],
    garlic: ['garlic'],
    ginger: ['ginger', 'adrak'],
    lemon: ['lemon', 'lime', 'nimbu'],
    coriander: ['coriander', 'cilantro', 'dhaniya'],
    mint: ['mint', 'pudina'],
    milk: ['milk'],
    egg: ['egg', 'eggs'],
    paneer: ['paneer', 'cottage cheese'],
    mushroom: ['mushroom', 'mushrooms'],
    peas: ['peas', 'green peas', 'matar'],
    beans: ['beans', 'green beans'],
    cabbage: ['cabbage'],
    cauliflower: ['cauliflower', 'gobi'],
    spinach: ['spinach', 'palak'],
    coconut: ['coconut']
  };

  var RECIPE_KEYWORDS_ALL = {};
  Object.keys(RECIPE_KEYWORDS).forEach(function (k) { RECIPE_KEYWORDS_ALL[k] = RECIPE_KEYWORDS[k]; });
  Object.keys(INGREDIENT_TOPICS).forEach(function (k) { RECIPE_KEYWORDS_ALL[k] = INGREDIENT_TOPICS[k]; });

  // Content templates so the agent works for any solo creator, not just food.
  var CONTENT_TEMPLATES = {
    recipe: {
      id: 'recipe',
      label: 'Recipe video',
      description: 'Cooking show-through. Tracks the dish on camera + ingredient callouts.',
      primarySubject: 'biryani',
      primaryLabel: 'biryani dish',
      visualSubjects: ['person', 'biryani'],
      checklist: DEFAULT_INGREDIENTS.slice(),
      keywords: RECIPE_KEYWORDS_ALL,
      reminderPrefix: 'you forgot to say about the ingredients'
    },
    vlog: {
      id: 'vlog',
      label: 'Solo vlog',
      description: 'Talking-to-camera. Keeps you framed, zooms to things you mention.',
      primarySubject: 'person',
      primaryLabel: 'you',
      visualSubjects: ['person'],
      checklist: ['intro', 'location', 'story', 'highlight', 'outro'],
      keywords: {
        intro: ['intro', 'welcome', 'hey guys', 'hello everyone'],
        location: ['location', 'place', 'here at', 'right now'],
        story: ['today', 'story', 'happened', 'morning'],
        highlight: ['highlight', 'best part', 'favorite', 'favourite', 'amazing', 'look at this'],
        outro: ['outro', 'bye', 'see you', 'subscribe', 'follow', 'take care']
      },
      reminderPrefix: 'you still have to cover'
    },
    product: {
      id: 'product',
      label: 'Product review',
      description: 'Unboxing / review. Tracks the product on camera + review beats.',
      primarySubject: 'product',
      primaryLabel: 'product',
      visualSubjects: ['person', 'product'],
      checklist: ['unboxing', 'design', 'features', 'demo', 'pros', 'cons', 'price', 'verdict'],
      keywords: {
        product: ['product', 'item', 'package', 'box', 'gadget', 'phone', 'device', 'review', 'bag'],
        handbag: ['handbag', 'handbags', 'purse', 'purses'],
        unboxing: ['unbox', 'opening', 'package', 'box'],
        design: ['design', 'build', 'material', 'looks', 'weight', 'size', 'detail', 'finish'],
        features: ['feature', 'spec', 'button', 'screen', 'battery', 'camera'],
        demo: ['demo', 'try', 'test', 'show you', 'watch'],
        pros: ['pros', 'love it', 'great', 'best'],
        cons: ['cons', 'hate', 'bad', 'worst', 'problem'],
        price: ['price', 'cost', 'rupees', 'dollars', 'worth'],
        verdict: ['verdict', 'recommend', 'rating', 'final thoughts', 'score']
      },
      reminderPrefix: 'you still have to cover'
    },
    tutorial: {
      id: 'tutorial',
      label: 'How-to / tutorial',
      description: 'Teach something. Tracks you + the demo object + lesson beats.',
      primarySubject: 'demo',
      primaryLabel: 'demo object',
      visualSubjects: ['person', 'demo'],
      checklist: ['goal', 'materials', 'steps', 'demo', 'mistakes', 'recap'],
      keywords: {
        demo: ['demo', 'example', 'look', 'watch', 'here'],
        goal: ['goal', 'learn', 'today i will show', 'by the end'],
        materials: ['need', 'materials', 'things you need', 'requirements'],
        steps: ['step', 'first', 'next', 'then', 'finally'],
        mistakes: ['mistake', 'wrong', 'careful', 'avoid', 'common error'],
        recap: ['recap', 'summary', 'remember', 'key takeaway']
      },
      reminderPrefix: 'you still have to cover'
    },
    custom: {
      id: 'custom',
      label: 'Custom',
      description: 'Your own occasion. Bring your own checklist of beats to hit.',
      primarySubject: 'subject',
      primaryLabel: 'subject',
      visualSubjects: ['person'],
      checklist: [],
      keywords: {},
      reminderPrefix: 'you still have to cover'
    }
  };

  var FOOD_LABELS = [
    'bowl', 'pizza', 'sandwich', 'cake', 'donut',
    'carrot', 'broccoli', 'apple', 'orange', 'banana', 'hot dog'
  ];
  var PRODUCT_LABELS = [
    'bottle', 'cup', 'book', 'cell phone', 'laptop', 'mouse', 'keyboard',
    'remote', 'backpack', 'handbag', 'suitcase', 'toothbrush', 'scissors',
    'teddy bear', 'sports ball', 'camera'
  ];
  var LABEL_ALIASES = {
    person: ['person'],
    biryani: ['biryani'].concat(FOOD_LABELS),
    product: ['product'].concat(PRODUCT_LABELS),
    dish: ['biryani'].concat(FOOD_LABELS)
  };

  // Everyday words for focus objects -> SAM labels, so "add phone"
  // zooms to the SAM "cell phone" box. Words with no detector label
  // (charger, headphones) stay checklist-only: mentioned and tracked, but
  // never zoomed to and never missing-nagged.
  var FOCUS_ALIASES = {
    phone: ['cell phone'], mobile: ['cell phone'],
    computer: ['laptop'], pc: ['laptop'],
    television: ['tv'], telly: ['tv'],
    bag: ['backpack', 'handbag', 'suitcase'],
    bike: ['bicycle', 'motorcycle'], cycle: ['bicycle']
  };

  var FOCUS_WORDS = [
    'phone', 'mobile', 'laptop', 'computer', 'headphones', 'earbuds',
    'watch', 'camera', 'bottle', 'cup', 'book', 'box', 'bag', 'handbag', 'backpack',
    'charger', 'keyboard', 'mouse', 'tablet', 'remote'
  ];

  // Words worth sending to SAM as a segment prompt: concrete, visible
  // things only — beats like "unboxing" would waste a call. Single words.
  function isFocusableWord(w) {
    w = String(w || '').toLowerCase().trim();
    if (!w || w.indexOf(' ') !== -1) return false;
    return FOCUS_WORDS.indexOf(w) !== -1 || PRODUCT_LABELS.indexOf(w) !== -1;
  }

  // Occasion -> suggested focus objects: "unboxing my new phone" -> [phone].
  function suggestFocusObjects(text) {
    var n = normalizeText(text);
    var out = [];
    for (var i = 0; i < FOCUS_WORDS.length; i++) {
      if (n.indexOf(' ' + FOCUS_WORDS[i] + ' ') !== -1) out.push(FOCUS_WORDS[i]);
    }
    return out.slice(0, 4);
  }

  // Topics that must be ON CAMERA when talked about (missing -> voice alert).
  // Checklist-only topics (rice, steps, price...) never trigger missing alerts.
  var VISUAL_TOPICS = ['person', 'biryani', 'dish', 'product', 'demo', 'subject'];

  var SELF_WORDS = [' i ', ' me ', ' my ', ' myself ', ' we ', ' our ', ' vlog'];

  function normalizeText(text) {
    return (' ' + String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ') + ' ')
      .replace(/\s+/g, ' ');
  }

  function mentionsSelf(text) {
    var n = normalizeText(text);
    for (var i = 0; i < SELF_WORDS.length; i++) {
      if (n.indexOf(SELF_WORDS[i]) !== -1) return true;
    }
    return false;
  }

  function getTemplate(id) {
    if (id && CONTENT_TEMPLATES[id]) return CONTENT_TEMPLATES[id];
    return CONTENT_TEMPLATES.recipe;
  }

  function listTemplates() {
    return Object.keys(CONTENT_TEMPLATES).map(function (id) {
      var t = CONTENT_TEMPLATES[id];
      return { id: t.id, label: t.label, description: t.description };
    });
  }

  // Custom checklist items become matchable keywords from their own words.
  var CUSTOM_STOPWORDS = ['the', 'and', 'with', 'for', 'your', 'you', 'are', 'our', 'this', 'that'];

  function keywordsForCustomItems(items) {
    var map = {};
    (items || []).forEach(function (item) {
      var key = String(item).toLowerCase().trim();
      if (!key) return;
      var words = key.split(/\s+/).filter(function (w) {
        return w.length > 2 && CUSTOM_STOPWORDS.indexOf(w) === -1;
      });
      map[key] = [key].concat(words);
    });
    return map;
  }

  function keywordsForTemplate(templateId, customItems) {
    var t = getTemplate(templateId);
    var merged = {};
    Object.keys(t.keywords || {}).forEach(function (k) { merged[k] = t.keywords[k]; });
    // Added items are matchable in EVERY session type (not just custom
    // templates): "add handbag" must be mentionable, coverable, and
    // focusable in a product review. Template keywords always win ties so
    // richer built-in match lists are never clobbered by item words.
    if (customItems && customItems.length) {
      var extra = keywordsForCustomItems(customItems);
      Object.keys(extra).forEach(function (k) { if (!merged[k]) merged[k] = extra[k]; });
    }
    return merged;
  }

  function checklistForTemplate(templateId, customItems) {
    if (customItems && customItems.length) return customItems.slice();
    return getTemplate(templateId).checklist.slice();
  }

  function findMentions(text, templateId, customItems) {
    var n = normalizeText(text);
    var map = templateId ? keywordsForTemplate(templateId, customItems) : RECIPE_KEYWORDS_ALL;
    var found = [];
    Object.keys(map).forEach(function (topic) {
      var kws = map[topic];
      for (var i = 0; i < kws.length; i++) {
        if (n.indexOf(' ' + kws[i]) !== -1) {
          found.push(topic);
          break;
        }
      }
    });
    // Concrete focus objects ("handbag") count as mentions in ANY template,
    // even when they are not on the checklist: SAM can still be asked for
    // them and the zoom/alert path can still use them.
    var focusHits = suggestFocusObjects(text);
    for (var fi = 0; fi < focusHits.length; fi++) {
      if (found.indexOf(focusHits[fi]) === -1) found.push(focusHits[fi]);
    }
    // Dish-level / visual topics first so zoom targets the thing, not the word.
    found.sort(function (a, b) {
      var av = isVisualTopic(a) ? 0 : 1;
      var bv = isVisualTopic(b) ? 0 : 1;
      return av - bv;
    });
    return found;
  }

  function isVisualTopic(topic) {
    if (VISUAL_TOPICS.indexOf(topic) !== -1) return true;
    // Focusable words are concrete visible things SAM can segment, so a
    // talked-about handbag alerts and zooms like any other subject.
    return isFocusableWord(topic);
  }

  // Occasion -> template: the setup chat asks "what's the occasion?" and the
  // answer picks the session template. No match falls back to custom.
  var OCCASION_HINTS = [
    { templateId: 'recipe', keywords: ['biryani', 'recipe', 'cook', 'food', 'bake', 'baking', 'kitchen', 'dish', 'meal', 'curry', 'cake', 'fry', 'roast'] },
    { templateId: 'vlog', keywords: ['vlog', 'vlogging', 'day in my life', 'daily vlog', 'daily', 'daily log', 'video log', 'logging', 'travel', 'trip', 'tour', 'room tour', 'house tour', 'home tour', 'city tour', 'routine', 'day out', 'birthday', 'party', 'myself', 'my face'] },
    { templateId: 'product', keywords: ['review', 'unboxing', 'unbox', 'product', 'gadget', 'headphone', 'earbuds', 'laptop', 'phone', 'haul', 'comparison', 'versus', 'handbag', 'handbags', 'purse', 'bag', 'bags', 'backpack'] },
    { templateId: 'tutorial', keywords: ['how to', 'tutorial', 'learn', 'lesson', 'fix', 'repair', 'guide', 'teach', 'course', 'diy', 'step by step'] }
  ];

  function suggestTemplate(text) {
    var n = normalizeText(text);
    var best = null;
    var bestHits = [];
    OCCASION_HINTS.forEach(function (h) {
      var hits = h.keywords.filter(function (k) { return n.indexOf(k) !== -1; });
      if (hits.length > 0 && hits.length > bestHits.length) {
        best = h.templateId;
        bestHits = hits;
      }
    });
    if (!best) return { templateId: 'custom', confidence: 'low', hits: [] };
    return { templateId: best, confidence: 'high', hits: bestHits };
  }

  var READY_RE = /^(when\s+you(\s+are|'re)\s+ready[\s,]+)?(yes[\s,]+|yeah[\s,]+|okay?[\s,]+|so[\s,]+|well[\s,]+|right[\s,]+|alright[\s,]+|now[\s,]+|and[\s,]+|hey[\s,]+)*(i'?m\s+ready|i am ready|ready|start(\s+record(ing)?)?|let'?s\s+go|begin)([\s,]+(start(\s+record(ing)?)?|let'?s\s+go|begin))?[\s!.]*$/i;

  // One-breath "looks good, I'm ready" (either order, fillers only between):
  // lock the list AND roll. Wishes and questions never match.
  var LOCKREADY_RE = (function () {
    var LOCK = "(looks good|lock( it( in)?| in)?|locked in|yes|yeah|okay?)";
    var RDY = "(i'?m\\s+ready|i am ready|ready|let'?s\\s+go)";
    var SEP = "[\\s,!.]*(?:so|and|yeah|okay?)?[\\s,!.]+";
    return new RegExp('^(?:' + LOCK + SEP + RDY + '|' + RDY + SEP + LOCK + ')[\\s!.]*$', 'i');
  })();

  function parseLockReady(text) {
    return LOCKREADY_RE.test(String(text || '').trim());
  }
  var HELP_RE = /\?|checklist|where|help|what now|status/i;

  var ADD_RE = /^(please\s+|can you\s+|could you\s+)?(add|include)\s+(.+?)[\s!.]*$/i;
  var REMOVE_RE = /^(please\s+|can you\s+|could you\s+)?(remove|delete|drop|skip)\s+(.+?)[\s!.]*$/i;

  // Checklist by chat: "add candles" / "remove onion" edits the list.
  function parseChecklistEdit(text) {
    var t = String(text || '').trim();
    var m = t.match(REMOVE_RE);
    if (m) return { action: 'remove', item: m[3].trim() };
    m = t.match(ADD_RE);
    if (m) return { action: 'add', item: m[3].trim() };
    return null;
  }

  // Away notice: "I'm going to fetch the onions" / "be right back" pauses the
  // missing-you alert for a while. Returns seconds, or null.
  var AWAY_RE = /going to (get|grab|fetch|bring|buy)|let me (get|grab|fetch|bring)|wait (a moment|a sec|a minute|a bit)|give me a (moment|sec|minute)|be right back|coming right back|i'll be back/i;
  var BACK_RE = /^(i'?m\s+back|i am back|back now|i'?m here)[\s!.]*$/i;

  function parseAwayNotice(text) {
    var t = String(text || '');
    if (!AWAY_RE.test(t)) return null;
    if (/be right back|coming right back|i'll be back/i.test(t)) return 60;
    return 45;
  }

  function isBackNotice(text) {
    return BACK_RE.test(String(text || '').trim());
  }

  // "I want a new session" / "start over": reset the occasion instead of
  // sticking with the old one. Anchored to session/occasion words so plain
  // occasions ("birthday vlog") and commands ("I'm ready") never match.
  var NEW_SESSION_RE = /\bnew session\b|\banother session\b|\bstart over\b|\bnew occasion\b|\b(different|another|change(\s+the)?)\s+occasion\b|\bswitch occasion\b/i;

  function isNewSessionRequest(text) {
    return NEW_SESSION_RE.test(String(text || ''));
  }

  // "What did I forget (to say)?" / "what did I miss" / "what is remaining":
  // must start as a what-question so "I forgot my keys" never matches.
  var FORGOT_RE = /^\s*what\b.{0,40}\b(forget|forgot|missed|miss|missing|remaining|left|pending)\b/i;

  function isForgotQuery(text) {
    return FORGOT_RE.test(String(text || ''));
  }

  // Post-setup chat intents: "I'm ready" must start recording (never become a
  // new occasion), and questions must be answered without touching the template.
  function setupIntent(text, step) {
    var t = String(text || '').trim();
    if (step === 'greet') return /look|explor/i.test(t) ? 'browse' : 'want-record';
    if (step === 'done') {
      if (READY_RE.test(t)) return 'ready';
      if (HELP_RE.test(t)) return 'help';
    }
    return 'occasion';
  }

  function aliasesFor(canonical) {
    if (LABEL_ALIASES[canonical]) return LABEL_ALIASES[canonical];
    if (FOCUS_ALIASES[canonical]) return FOCUS_ALIASES[canonical];
    return [canonical];
  }

  function findDetection(detections, canonical) {
    var list = detections || [];
    // Generic subjects (demo/custom): any confident non-person object counts.
    if (canonical === 'demo' || canonical === 'subject') {
      var bestAny = null;
      for (var j = 0; j < list.length; j++) {
        var o = list[j];
        if (!o || o.score < 0.4) continue;
        if (String(o.label).toLowerCase() === 'person') continue;
        if (!bestAny || o.score > bestAny.score) bestAny = o;
      }
      return bestAny;
    }
    var aliases = aliasesFor(canonical);
    var best = null;
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (!d || d.score < 0.35) continue;
      if (aliases.indexOf(String(d.label).toLowerCase()) === -1) continue;
      if (!best || d.score > best.score) best = d;
    }
    return best;
  }

  function checkVisibility(detections, canonical) {
    var det = findDetection(detections, canonical);
    return { visible: !!det, detection: det || null };
  }

  function bboxCenter(bbox) {
    return { x: bbox[0] + bbox[2] / 2, y: bbox[1] + bbox[3] / 2 };
  }

  function bboxArea(bbox) {
    return Math.max(0, bbox[2]) * Math.max(0, bbox[3]);
  }

  // Showing check: the product's center is up in the face zone (top of the
  // person box, small margin outside the silhouette still counts). Holding
  // the product to the face zooms to it; a pot down on the table does not.
  function isHeldNearFace(personBbox, subjectBbox) {
    if (!personBbox || !subjectBbox) return false;
    var px = personBbox[0], py = personBbox[1], pw = personBbox[2], ph = personBbox[3];
    var c = bboxCenter(subjectBbox);
    var margin = 0.12 * Math.max(pw, ph);
    var inX = c.x >= px - margin && c.x <= px + pw + margin;
    var inY = c.y >= py - margin && c.y <= py + ph * 0.45 + margin;
    return inX && inY;
  }

  // Half-visible person: touching one side edge with the center pushed out
  // past the thirds line, or the head cut at the top. Centered boxes
  // touching both sides are close-ups (too-close owns that case), bottom
  // touches are normal talking-head framing, and a raised arm over a full
  // body runs edge to edge instead of ending mid-frame.
  function personHalfOut(bbox) {
    if (!bbox || bbox.length < 4) return false;
    var x = bbox[0], y = bbox[1], w = bbox[2], h = bbox[3];
    if (!(w > 0 && h > 0)) return false;
    var cx = x + w / 2, cy = y + h / 2;
    if (x <= 0.02 && x + w < 0.98 && cx < 1 / 3) return true;
    if (x + w >= 0.98 && x > 0.02 && cx > 2 / 3) return true;
    if (y <= 0.02 && h < 0.8 && cy < 0.45) return true;
    return false;
  }

  function subjectMissingCode(templateId) {
    if (templateId === 'product') return 'PRODUCT_MISSING';
    if (templateId === 'tutorial') return 'DEMO_MISSING';
    if (templateId === 'custom') return 'SUBJECT_MISSING';
    return 'DISH_MISSING';
  }

  // Pure frame judge: person + template subject placement. bbox = [x,y,w,h] 0..1.
  function analyzeFrame(opts) {
    opts = opts || {};
    var detections = opts.detections || [];
    var templateId = opts.templateId || opts.mode || 'recipe';
    var t = getTemplate(templateId);
    var person = findDetection(detections, 'person');
    var subject = null;
    if (t.primarySubject !== 'person') {
      subject = findDetection(detections, t.primarySubject);
    }
    var issues = [];

    if (!person) {
      issues.push({ code: 'USER_MISSING', message: 'You are missing from the frame' });
    } else {
      var c = bboxCenter(person.bbox);
      var area = bboxArea(person.bbox);
      if (c.x < 0.25 || c.x > 0.75) {
        issues.push({ code: 'PERSON_OFF_CENTER', message: 'Move toward the center of the frame' });
      }
      if (area < 0.04) {
        issues.push({ code: 'PERSON_TOO_SMALL', message: 'You look too far — move closer' });
      } else if (area > 0.65) {
        issues.push({ code: 'PERSON_TOO_CLOSE', message: 'You look cropped — step back a little' });
      }
      if (personHalfOut(person.bbox)) {
        issues.push({ code: 'PERSON_HALF_OUT', message: 'You look half out of frame — step fully into the shot' });
      }
    }

    if (t.primarySubject !== 'person' && !subject) {
      issues.push({ code: subjectMissingCode(templateId), message: t.primaryLabel + ' is not visible in the frame' });
    }

    var blocking = issues.some(function (it) {
      return it.code === 'USER_MISSING' || it.code === 'PERSON_HALF_OUT' ||
        it.code === subjectMissingCode(templateId);
    });
    return { good: !blocking, issues: issues, person: person, subject: subject, templateId: t.id };
  }

  function ContentChecklist(items) {
    this.items = (items && items.length ? items : []).slice();
    this.mentioned = {};
    this.order = [];
  }

  ContentChecklist.prototype.processText = function (text, templateId) {
    var found = findMentions(text, templateId || 'recipe', this.items);
    for (var i = 0; i < found.length; i++) {
      this.mentioned[found[i]] = true;
      var hit = this.items.filter(function (it) {
        return String(it).toLowerCase() === found[i];
      })[0];
      if (hit && this.order.indexOf(hit) === -1) this.order.push(hit);
    }
    // Alias coverage: "this is the bag" covers a "handbag" item (and "here
    // is the product" does too) via the shared alias tables, either way.
    for (var k = 0; k < this.items.length; k++) {
      var item = this.items[k];
      var low = String(item).toLowerCase();
      if (this.mentioned[low]) continue;
      for (var f = 0; f < found.length; f++) {
        if (aliasesFor(found[f]).indexOf(low) !== -1 || aliasesFor(low).indexOf(found[f]) !== -1) {
          this.mentioned[low] = true;
          if (this.order.indexOf(item) === -1) this.order.push(item);
          break;
        }
      }
    }
    return found;
  };

  // Items skipped over: uncovered items listed before the furthest-covered one.
  ContentChecklist.prototype.getSkipped = function () {
    var self = this;
    var maxCovered = -1;
    this.items.forEach(function (it, i) {
      if (self.mentioned[String(it).toLowerCase()]) maxCovered = Math.max(maxCovered, i);
    });
    if (maxCovered < 0) return [];
    return this.items.filter(function (it, i) {
      return i < maxCovered && !self.mentioned[String(it).toLowerCase()];
    });
  };

  ContentChecklist.prototype.getOrderNote = function () {
    var skipped = this.getSkipped();
    if (!skipped.length || !this.order.length) return null;
    return this.order[this.order.length - 1] + ' was covered before ' + skipped.join(', ');
  };

  ContentChecklist.prototype.getMentioned = function () {
    var self = this;
    return this.items.filter(function (ing) { return !!self.mentioned[String(ing).toLowerCase()]; });
  };

  ContentChecklist.prototype.getMissing = function () {
    var self = this;
    return this.items.filter(function (ing) { return !self.mentioned[String(ing).toLowerCase()]; });
  };

  ContentChecklist.prototype.getCoverage = function () {
    if (!this.items.length) return 1;
    return this.getMentioned().length / this.items.length;
  };

  // Back-compat alias: the recipe checklist is just a content checklist.
  function RecipeChecklist(ingredients) {
    ContentChecklist.call(this, ingredients && ingredients.length ? ingredients : DEFAULT_INGREDIENTS);
  }
  RecipeChecklist.prototype = Object.create(ContentChecklist.prototype);
  RecipeChecklist.prototype.constructor = RecipeChecklist;
  RecipeChecklist.prototype.processText = function (text) {
    return ContentChecklist.prototype.processText.call(this, text, 'recipe');
  };

  // Tracks what the creator is currently talking about.
  // Zoom stays in until the topic goes quiet for timeoutMs.
  function TopicTracker(timeoutMs) {
    this.timeoutMs = timeoutMs || TOPIC_TIMEOUT_MS;
    this.active = null;
    this.lastSeenMs = 0;
  }

  TopicTracker.prototype.update = function (mentioned, nowMs) {
    var justCleared = null;
    if (mentioned && mentioned.length > 0) {
      this.active = mentioned[0];
      this.lastSeenMs = nowMs;
    } else if (this.active && nowMs - this.lastSeenMs >= this.timeoutMs) {
      justCleared = this.active;
      this.active = null;
    }
    return { active: this.getActive(nowMs), justCleared: justCleared };
  };

  TopicTracker.prototype.getActive = function (nowMs) {
    if (this.active && nowMs - this.lastSeenMs >= this.timeoutMs) {
      this.active = null;
    }
    return this.active;
  };

  function ZoomController() {
    this.zoom = 1.0;
    this.focus = null;
  }

  ZoomController.prototype.update = function (opts) {
    opts = opts || {};
    var det = opts.detection || null;
    var target = det ? ZOOM_IN_LEVEL : 1.0;
    // Product-only framing: size the zoom from the SAM box so the product
    // fills the program output by itself (small margin kept), instead of a
    // fixed push-in that leaves a small product floating in background.
    if (det && opts.fill && det.bbox && det.bbox[2] > 0 && det.bbox[3] > 0) {
      target = Math.min(1 / det.bbox[2], 1 / det.bbox[3]) * 0.85;
      target = Math.max(1.0, Math.min(FILL_ZOOM_MAX, target));
    }
    if (det) this.focus = det.bbox;
    if (target === 1.0 && this.zoom < 1.08) this.focus = null;
    this.zoom += (target - this.zoom) * 0.18;
    if (Math.abs(target - this.zoom) < 0.02) this.zoom = target;
    return { zoom: this.zoom, target: target, focus: this.focus };
  };

  ZoomController.prototype.getCrop = function (frameW, frameH) {
    if (!this.focus || this.zoom <= 1.02) {
      return { x: 0, y: 0, w: frameW, h: frameH, zoom: this.zoom };
    }
    var cw = Math.round(frameW / this.zoom);
    var ch = Math.round(frameH / this.zoom);
    var c = bboxCenter(this.focus);
    var x = Math.round(c.x * frameW - cw / 2);
    var y = Math.round(c.y * frameH - ch / 2);
    x = Math.max(0, Math.min(frameW - cw, x));
    y = Math.max(0, Math.min(frameH - ch, y));
    return { x: x, y: y, w: cw, h: ch, zoom: this.zoom };
  };

  // Gesture shutter: a raised hand starts a countdown, then the photo fires.
  // The hand may come down after triggering — the countdown still fires, so
  // the creator has time to pose. Re-arms only on a falling edge + cooldown.
  function GestureShutter(opts) {
    opts = opts || {};
    this.delayMs = opts.delayMs || 5000;
    this.cooldownMs = opts.cooldownMs || 10000;
    this.reset();
  }

  GestureShutter.prototype.reset = function () {
    this.captureAtMs = 0;
    this.cooldownUntilMs = 0;
    this.wasUp = false;
  };

  // Returns 'countdown' when a countdown starts, 'capture' when it fires.
  GestureShutter.prototype.update = function (handRaised, nowMs) {
    var raised = !!handRaised;
    var event = null;
    if (raised && !this.wasUp && !this.captureAtMs && nowMs > this.cooldownUntilMs) {
      this.captureAtMs = nowMs + this.delayMs;
      event = 'countdown';
    } else if (this.captureAtMs && nowMs >= this.captureAtMs) {
      this.captureAtMs = 0;
      this.cooldownUntilMs = nowMs + this.cooldownMs;
      event = 'capture';
    }
    this.wasUp = raised;
    return event;
  };

  GestureShutter.prototype.remainingSec = function (nowMs) {
    if (!this.captureAtMs) return 0;
    return Math.max(1, Math.ceil((this.captureAtMs - nowMs) / 1000));
  };

  // Gesture anywhere: fixed frame zones (no person box needed, so a high-five
  // reads even when cropped too tight for geometry). A hand ENTERING a zone
  // spikes its skin share; steady ambient skin never fires. The first update
  // only sets the baseline. Latches until the hand leaves.
  function HandWave(opts) {
    opts = opts || {};
    this.jumpNeeded = opts.jumpNeeded || 0.08;
    this.minShare = opts.minShare || 0.10;
    this.highShare = opts.highShare || 0.16;
    this.confirmTicks = opts.confirmTicks || 2;
    this.latchMs = opts.latchMs || 8000;
    this.reset();
  }

  HandWave.prototype.reset = function () {
    this.prev = null;
    this.hotTicks = 0;
    this.latchedUntil = 0;
  };

  // ratios: skin share 0..1 per zone, same order every call. True on the
  // sustained rising edge only, then quiet for latchMs (a held hand must
  // not retrigger, and zones with steady skin can never latch forever).
  HandWave.prototype.update = function (ratios, nowMs) {
    ratios = ratios || [];
    nowMs = nowMs || 0;
    if (!this.prev) {
      this.prev = ratios.slice();
      return false;
    }
    var hot = false, i, r, prev;
    for (i = 0; i < ratios.length; i++) {
      r = ratios[i] || 0;
      prev = this.prev[i] || 0;
      if (r >= this.highShare || (r >= this.minShare && r - prev >= this.jumpNeeded)) {
        hot = true;
        break;
      }
    }
    this.prev = ratios.slice();
    if (nowMs < this.latchedUntil) return false;
    if (hot) {
      this.hotTicks++;
      if (this.hotTicks >= this.confirmTicks) {
        this.latchedUntil = nowMs + this.latchMs;
        this.hotTicks = 0;
        return true;
      }
    } else {
      this.hotTicks = 0;
    }
    return false;
  };

  // Auto pause/resume for the recorder: when a context-needed presence goes
  // missing, pause after a few steady bad ticks; resume after steady good
  // ticks. Persistence both ways so one noisy frame never flaps the file.
  function RecordingPause(opts) {
    opts = opts || {};
    // Two and two: detections refresh on SAM's 4s cadence, so extra same-data
    // ticks only delay the pause without filtering any real flap.
    this.pauseAfter = opts.pauseAfter || 2;
    this.resumeAfter = opts.resumeAfter || 2;
    this.reset();
  }

  RecordingPause.prototype.reset = function () {
    this.bad = 0;
    this.good = 0;
    this.paused = false;
    this.latched = false;
    this.latchUntilMs = 0;
  };

  // Reminder latch: a "you forgot X" alert pauses immediately (no waiting
  // for persistence) and holds until the app releases it (said it / timed
  // out). Returns 'pause' on the transition, null when already paused.
  RecordingPause.prototype.forcePause = function (untilMs) {
    this.latched = true;
    this.latchUntilMs = untilMs;
    this.bad = 0;
    this.good = 0;
    if (this.paused) return null;
    this.paused = true;
    return 'pause';
  };

  RecordingPause.prototype.releaseLatch = function () {
    this.latched = false;
    this.latchUntilMs = 0;
  };

  // Who must be on camera, from the template + situation. Vlogs need you
  // always; product reviews need the product always; everywhere else you
  // matter while self-talking and the subject while talked about; showing
  // a place or tour mode never demands you.
  function presenceNeeded(templateId, opts) {
    opts = opts || {};
    if (opts.showing) return { needUser: false, needSubject: templateId === 'product' };
    return {
      needUser: templateId === 'vlog' ? true : !!opts.selfTalking,
      needSubject: templateId === 'product' ? true : !!opts.subjectTalked
    };
  }

  // Recording gate: bad footage is paused, not recorded. Missing presences
  // pause only when the context needs them; a cropped face or bad light
  // pauses on its own. Returns reason codes so the app can speak the fix.
  // Soft hints (off-center, too small, busy background) stay hints — pausing
  // on every drift would chop the video into pieces.
  function recordingBlocked(opts) {
    opts = opts || {};
    var reasons = [];
    if (opts.needUser && opts.userMissing) reasons.push('user');
    if (opts.needSubject && opts.subjectMissing) reasons.push('subject');
    if (opts.tooClose) reasons.push('close');
    if (opts.halfOut) reasons.push('half');
    if (opts.light === 'dark' || opts.light === 'washed') reasons.push('light');
    return { blocked: reasons.length > 0, reasons: reasons };
  }

  // Sticky SAM subject: a talked-about topic goes quiet after 8s but a held
  // object stays held, so SAM keeps getting asked for the last held thing
  // while fresh — otherwise the zoom fires once and reverts mid-demo.
  var HELD_STICKY_MS = 20000;
  function stickySubject(label, lastMs, nowMs) {
    if (!label || !lastMs || !nowMs) return null;
    if (nowMs - lastMs > HELD_STICKY_MS) return null;
    var w = String(label).toLowerCase().trim();
    return isFocusableWord(w) ? w : null;
  }

  // Answer lift: a reminder ("you forgot X") pause must not eat the answer
  // that clears it. Fresh user speech rolls again — but only reminder
  // latches, never rule pauses (broken shot stays strict), never while the
  // agent owns the mic, and never inside the echo tail window.
  var ANSWER_LIFT_MS = 1500;
  function answerLift(opts) {
    opts = opts || {};
    if (!opts.latched || !opts.recordPaused) return false;
    if (opts.speaking) return false;
    if (!opts.echoQuiet) return false;
    if (!opts.lastSpeechMs) return false;
    return (opts.nowMs || 0) - opts.lastSpeechMs < ANSWER_LIFT_MS;
  }

  // Poll scheduler: a launched poll waits the full server cadence, but a
  // skipped tick (in-flight, camera off) retries in 1s — a fixed interval
  // would let one slow poll stretch the effective rate to 8s+.
  var SAM_POLL_MS = 4000, SAM_RETRY_MS = 1000;
  function nextPollDelay(launched) {
    return launched ? SAM_POLL_MS : SAM_RETRY_MS;
  }

  // missing: true when a demanded presence is currently out of frame.
  // Returns 'pause', 'resume', or null.
  RecordingPause.prototype.update = function (missing) {
    if (this.latched) missing = true;
    if (missing) {
      this.bad++;
      this.good = 0;
    } else {
      this.good++;
      this.bad = 0;
    }
    if (!this.paused && this.bad >= this.pauseAfter) {
      this.paused = true;
      return 'pause';
    }
    if (this.paused && this.good >= this.resumeAfter) {
      this.paused = false;
      return 'resume';
    }
    return null;
  };

  function subjectLabelFor(templateId, topic) {
    var t = getTemplate(templateId);
    if (topic && topic !== t.primarySubject && isVisualTopic(topic)) return topic;
    return t.primaryLabel;
  }

  function AlertManager(opts) {
    opts = opts || {};
    this.cooldownMs = opts.cooldownMs || 10000;
    this.checklistCooldownMs = opts.checklistCooldownMs || 60000;
    this.subjectPersistMs = opts.subjectPersistMs || opts.dishPersistMs || 3000;
    this.lastFired = {};
    this.episodes = {};
    this.__lastTopic = null;
  }

  AlertManager.prototype._ready = function (key, nowMs, cooldown) {
    var last = ('__last_' + key in this) ? this['__last_' + key] : -Infinity;
    void last;
    var prev = this.lastFired[key];
    if (prev === undefined) prev = -Infinity;
    return nowMs - prev >= (cooldown || this.cooldownMs);
  };

  // Episode gate: say it once per episode, never on repeat. Fires after
  // fireMs of steady truth; re-arms only after clearMs of steady false, so
  // a flickering detector can't nag either.
  AlertManager.prototype._episode = function (key, condition, nowMs, fireMs, clearMs) {
    var st = this.episodes[key];
    if (!st) st = this.episodes[key] = { fired: false, since: 0, clearSince: 0 };
    if (!condition) {
      if (!st.fired) {
        st.since = 0;
        st.clearSince = 0;
        return false;
      }
      if (!st.clearSince) st.clearSince = nowMs;
      if (nowMs - st.clearSince >= clearMs) {
        st.fired = false;
        st.since = 0;
        st.clearSince = 0;
      }
      return false;
    }
    st.clearSince = 0;
    if (st.fired) return false;
    if (!st.since) {
      st.since = nowMs;
      return false;
    }
    if (nowMs - st.since >= fireMs) {
      st.fired = true;
      return true;
    }
    return false;
  };

  AlertManager.prototype._fire = function (key, nowMs, text, priority) {
    this.lastFired[key] = nowMs;
    return { key: key, text: text, priority: priority };
  };

  AlertManager.prototype.decide = function (state) {
    state = state || {};
    var nowMs = state.nowMs || 0;
    var frame = state.frame || { issues: [] };
    var activeTopic = state.activeTopic || null;
    var topicVisible = state.topicVisible !== false;
    var recordingMs = state.recordingMs || 0;
    var userName = state.userName || 'Bhanu';
    var skipped = state.checklistSkipped || [];
    var templateId = state.templateId || frame.templateId || 'recipe';
    var t = getTemplate(templateId);
    var out = [];

    function has(code) {
      return frame.issues.some(function (it) { return it.code === code; });
    }
    var subjectCode = subjectMissingCode(templateId);
    var subjectMissing = has(subjectCode);

    // 1. Creator missing while the context needs them on camera — i.e. they
    // are talking about themselves, or the session is a photo shoot where
    // posing is silent and the frame must be directed proactively. Missing
    // alone never pages them, and an away notice ("going to fetch X")
    // pauses this entirely.
    var away = state.awayUntilMs && nowMs < state.awayUntilMs;
    var userNeeded = !away && (!!state.selfTalking || !!state.proactiveFrame);
    if (this._episode('user-missing', userNeeded && has('USER_MISSING') && recordingMs > 1000, nowMs, 2000, 4000) &&
        this._ready('user-missing', nowMs)) {
      out.push(this._fire('user-missing', nowMs,
        userName + ', you are missing from the frame', 1));
    }

    // 2. Talked-about subject not visible (zoom was attempted, still missing).
    var subjectTopic = activeTopic && (activeTopic === t.primarySubject || activeTopic === 'dish');
    if (this._episode('subject-missing', !!subjectTopic && subjectMissing, nowMs, this.subjectPersistMs, 3000) &&
        this._ready('subject-missing', nowMs)) {
      out.push(this._fire('subject-missing', nowMs,
        userName + ', ' + t.primaryLabel + ' is not visible in the frame', 2));
    }

    // 3. Any other VISIBLE-type mentioned object not on camera. A new topic
    // resets the episode so each subject is announced once.
    if (activeTopic !== this.__lastTopic) {
      this.__lastTopic = activeTopic;
      Object.keys(this.episodes).forEach(function (k) {
        if (k.indexOf('topic:') === 0) delete this.episodes[k];
      }, this);
    }
    // Generic placeholders ('demo', 'subject') only mean a physical object in
    // their own template (covered by branch 2 there) — elsewhere they are
    // checklist beats, never missing-object alerts. Same for self-references:
    // "friendly cameraman" must never nag that the filming camera is missing.
    var genericTopic = activeTopic === 'demo' || activeTopic === 'subject';
    var selfRefTopic = activeTopic === 'camera' || activeTopic === 'cam';
    var topicIssue = !!(activeTopic && !genericTopic && !selfRefTopic && isVisualTopic(activeTopic) && activeTopic !== t.primarySubject && !topicVisible);
    if (topicIssue && this._episode('topic:' + activeTopic, true, nowMs, 0, 3000) &&
        this._ready('topic:' + activeTopic, nowMs)) {
      out.push(this._fire('topic:' + activeTopic, nowMs,
        userName + ', ' + subjectLabelFor(templateId, activeTopic) + ' is mentioned but not visible', 3));
    }

    // 4. Skipped-beat reminder (generous delay, rare repeat): only beats
    // you jumped over nag mid-take. Trailing beats — the outro while you
    // are mid-story — are unreached, not forgotten; never-said beats are
    // still listed at Stop.
    if (recordingMs > 45000 && skipped.length > 0 &&
        this._ready('checklist', nowMs, this.checklistCooldownMs)) {
      var sample = skipped.slice(0, 3).join(', ');
      out.push(this._fire('checklist', nowMs,
        userName + ', ' + t.reminderPrefix + ': ' + sample, 4));
    }

    // 5. Soft framing hints (lowest priority, at most one per decision, said
    // once per episode — the director line keeps showing it meanwhile).
    var framingCode = has('PERSON_OFF_CENTER') ? 'center'
      : has('PERSON_TOO_SMALL') ? 'far'
      : has('PERSON_TOO_CLOSE') ? 'close' : null;
    var framingFire = this._episode('framing', !!framingCode, nowMs, 0, 3000);
    if (out.length === 0 && framingCode && framingFire && this._ready('framing', nowMs, 20000)) {
      var hint = framingCode === 'center' ? 'Move toward the center for a better frame'
        : framingCode === 'far' ? 'You look too far from the camera'
        : 'You look cropped, step back a little';
      out.push(this._fire('framing', nowMs, hint, 5));
    }

    out.sort(function (a, b) { return a.priority - b.priority; });
    return out;
  };

  // Mode: photos or videos? First question of the setup chat.
  var PHOTO_MODE_WORDS = ['photo', 'photos', 'selfie', 'selfies', 'picture', 'pictures', 'portrait', 'photoshoot'];
  var VIDEO_MODE_WORDS = ['video', 'videos', 'vlog', 'record', 'shoot', 'film', 'reel', 'reels', 'youtube', 'stream'];

  function detectMode(text) {
    var n = normalizeText(text);
    var p = 0, v = 0, i;
    for (i = 0; i < PHOTO_MODE_WORDS.length; i++) if (n.indexOf(PHOTO_MODE_WORDS[i]) !== -1) p++;
    for (i = 0; i < VIDEO_MODE_WORDS.length; i++) if (n.indexOf(VIDEO_MODE_WORDS[i]) !== -1) v++;
    if (p > 0 && v === 0) return 'photo';
    if (v > 0 && p === 0) return 'video';
    return null;
  }

  function photoOccasionLabel(text) {
    var n = normalizeText(text);
    if (/selfie|self portrait|portrait/.test(n)) return 'selfie';
    if (/birthday|bday|cake/.test(n)) return 'birthday';
    if (/group|family|friends|team|couple/.test(n)) return 'group';
    if (photoSubject(text)) return 'object';
    return 'custom';
  }

  // Object-photo subject: "take a picture of a phone" -> "the phone".
  // Only "photo of X" counts — "photo with X" is still the user plus a
  // thing, and "of me / of friends" falls through to the person labels.
  function photoSubject(text) {
    var n = normalizeText(text);
    var m = n.match(/\b(?:photos?|pictures?|shots?|snaps?|images?)\b.{0,40}?\bof\s+([a-z][a-z ]{0,30})/);
    if (!m) return null;
    var phrase = m[1].replace(/\s+(for|with|and|then|please|now|today|here)\b.*$/, '')
      .trim().split(/\s+/).slice(0, 3).join(' ');
    if (!phrase) return null;
    if (/^(me|myself|us|ourselves|ours|family|friends?|group|team|couple|selfie)\b/.test(phrase)) return null;
    if (/^(a|an)\b/.test(phrase)) return phrase.replace(/^(a|an)\b/, 'the');
    if (/^(my|this|that|these|those|the|some)\b/.test(phrase)) return phrase;
    return 'the ' + phrase;
  }

  var PHOTO_SHOTLISTS = {
    selfie: ['Face the light', 'Look at the lens', 'Smile', 'Capture the shot'],
    birthday: ['Wide shot with the cake', 'Look at the camera', 'Close-up of the cake', 'Candid laugh'],
    group: ['Everyone in frame', 'Look at the camera', 'Smile together', 'Capture the shot'],
    custom: ['Get in frame', 'Check the light', 'Capture the shot']
  };

  function photoShotList(label, subject) {
    if (label === 'object') {
      var s = subject || 'the subject';
      return ['Show ' + s, 'Check the light', 'Fill the frame', 'Capture the shot'];
    }
    return (PHOTO_SHOTLISTS[label] || PHOTO_SHOTLISTS.custom).slice();
  }

  var PHOTO_TIPS = {
    selfie: [
      'Hold the camera at eye level, slightly above.',
      'Look into the lens, not the screen.',
      'Face the light — a window in front beats one behind.',
      'Chin slightly down, hair off your forehead, and smile.'
    ],
    birthday: [
      'Get the cake, candles, and your face in one frame.',
      'Look up at the camera, not down at the cake.',
      'Take one wide shot, then one close-up of the cake.',
      'Keep your hands visible while you cut.'
    ],
    group: [
      "Tallest in back, everyone's face visible.",
      'Everyone look at the lens on three.',
      'Squeeze closer than feels natural.',
      'Take two in a row — someone always blinks.'
    ],
    custom: [
      'Face the light and look into the lens.',
      "Fill the frame, but don't crop your head.",
      'Hold still a beat before you capture.',
      'Take a few — I will pick the best.'
    ]
  };

  function suggestPhotoTips(label, subject) {
    if (label === 'object') {
      var s = subject || 'the subject';
      return { label: 'object', tips: [
        'Hold ' + s + ' steady and fill the frame with it.',
        'Put the light on ' + s + ' — avoid harsh shadows.',
        'Tap to focus on ' + s + ' before you capture.',
        'Take a few angles — I will pick the best.'
      ] };
    }
    var tips = PHOTO_TIPS[label] || PHOTO_TIPS.custom;
    return { label: label in PHOTO_TIPS ? label : 'custom', tips: tips.slice() };
  }

  // Live recording commands. Real STT output carries fillers ("okay", "for me",
  // "can you"), so every command tolerates them. Stop/start/camera stay
  // anchored: firing mid-sentence would end the session or roll too early.
  // Capture is contains-matched instead — a stray extra photo is harmless
  // (scored and kept), while a missed "capture" ruins the moment.
  var CMD_LEAD = '(?:(?:please|can you|could you|would you|okay?|now|so|well|right|alright|and|hey|um+|uh+|er)[,\\s]+)*';
  var CMD_TRAIL = '(?:[,\\s]+(?:please|now|for me|right now|thanks|thank you))?[\\s!.]*';
  // Stop fires when the utterance ENDS with a stop command: "okay I'm done,
  // thank you, stop the recording" must stop (real transcript), while "we
  // will stop for lunch" must not. Negations ("don't stop") never fire.
  var STOP_END_RE = /\bstop(\s+(the\s+)?(record(ing)?|video|session|everything))?(\s+(please|now|right now))?[\s!.]*$/i;
  var STOP_NEG_RE = /\b(don't|dont|do not|never|not)\s+stop\b/i;
  // Sign-offs end the session like stop does: "bye for this video",
  // "that's it for today", "goodbye". Utterance-final, so "say bye to
  // the camera" (a direction, not a sign-off) never fires.
  var BYE_END_RE = /\b(bye(\s+bye)?(\s+for\s+(this|that)\s+(video|vlog|session|one))?|good\s?bye|that'?s\s+(it|all)\s+for\s+(today|tonight|now|this\s+(video|vlog|session|one)))[\s!.]*$/i;
  var START_RE = new RegExp('^' + CMD_LEAD + '(start(\\s+(record(ing)?|the\\s+(video|session)))?|record|roll(ing)?)' + CMD_TRAIL + '$', 'i');
  var CAMERA_RE = new RegExp('^' + CMD_LEAD + '((start|turn on|switch on|open|enable)(\\s+the)?\\s+camera|camera\\s+on)' + CMD_TRAIL + '$', 'i');
  var CAMERA_OFF_RE = new RegExp('^' + CMD_LEAD + '((stop|turn off|switch off|disable)(\\s+the)?\\s+camera|camera\\s+off)' + CMD_TRAIL + '$', 'i');
  // No bare "cheese"/"click": "add cheese" and "click the link" are normal
  // speech. Bare "capture"/"shoot" and "say cheese" are unambiguous enough.
  var CAPTURE_CMD_RE = /\b(capture|take(\s+my)?(\s+a)?\s+(photo|picture|pic)|click(\s+it|\s+my\s+(photo|picture|pic)|\s+a\s+(photo|picture|pic))|shoot(\s+me)?|say\s+cheese|snap(\s+a)?\s+(photo|picture|pic))\b/i;
  var CAPTURE_COUNT_RE = /(capture|take|click|shoot|need|want|give me)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i;
  var CAPTURE_COUNT_CMD_RE = /(capture|take|click|shoot)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i;
  var PHOTO_SOLO_RE = /^(cheese|click)[\s!.]*$/i;
  // STT manglings heard in real photo sessions: "capital" for "capture",
  // "it's a photo" for "take a photo". Photo-mode only — a stray photo is
  // harmless and a missed capture ruins the moment.
  var CAPTURE_MANGLE_RE = /\bcapital\b|it'?s a (photo|picture|pic)\b/i;
  var NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  var APPROVE_RE = /^(please\s+)?(yes|yeah|yep|ok(ay)?|sure|lock( it( in)?| in)?|approve(d)?|confirm(ed)?|looks good|that'?s good|perfect|correct|locked in)[\s!.,]*$/i;
  var LOOK_RE = /am i|do i look|how do i look|looking good|looks good|look good|how is my|how's my|my (hair|face|smile)|am i (visible|clear|blurry|in frame)|angle|is this (ok|okay|good|fine)|shot (ok|okay|good)|frame (ok|okay|good)/i;

  function parseRecordingCommand(text, mode) {
    var t = String(text || '').trim();
    if (!STOP_NEG_RE.test(t) && (STOP_END_RE.test(t) || BYE_END_RE.test(t))) return 'stop';
    if (CAMERA_RE.test(t)) return 'camera';
    if (CAMERA_OFF_RE.test(t)) return 'camera-off';
    if (START_RE.test(t)) return 'start';
    // Capture works in both modes: photo sessions click, video sessions snap
    // a still. Loose counts ("need two eggs") only count in photo mode.
    if (CAPTURE_CMD_RE.test(t) || CAPTURE_COUNT_CMD_RE.test(t)) return 'capture';
    if (mode === 'photo' && (PHOTO_SOLO_RE.test(t) || CAPTURE_COUNT_RE.test(t) || CAPTURE_MANGLE_RE.test(t))) return 'capture';
    return null;
  }

  // "capture 5" / "take 3 photos" / "I want five pictures" -> 5/3/5 (1..10).
  // Single-shot words ("capture me", "cheese") return null.
  function parseCaptureCount(text) {
    var m = String(text || '').match(CAPTURE_COUNT_RE);
    if (!m) return null;
    var raw = m[2].toLowerCase();
    var n = NUMBER_WORDS[raw] != null ? NUMBER_WORDS[raw] : parseInt(raw, 10);
    if (isNaN(n)) return null;
    return Math.max(1, Math.min(10, n));
  }

  // Checklist approval: "yes" / "looks good" / "approve" locks the list.
  function isApproval(text) {
    return APPROVE_RE.test(String(text || '').trim());
  }

  // Photo capture gate: which single noun must be visible before the shot
  // is allowed (birthday needs the cake, an object session its subject,
  // selfie needs you). Group has no single gate.
  function photoRequiredNoun(label, subject) {
    if (label === 'birthday') return 'cake';
    if (label === 'selfie') return 'person';
    if (label === 'object' && subject) {
      var noun = String(subject).replace(/^(the|my|this|that|a|an)\s+/i, '').trim();
      return noun || null;
    }
    return null;
  }

  // Agent parroting: the user reading the agent's own meta-lines back
  // ("got it sticking with your solo vlog", "say looks good or add x").
  // Only exact agent phrasing matches — legit occasions, edits, and
  // approvals never do.
  var PARROT_RE = /sticking with|keeping your|describe a new occasion|add x\b|remove y\b|say ["']?looks good/i;

  function isAgentParrot(text) {
    return PARROT_RE.test(String(text || ''));
  }

  // Capture quality gate: a bad shot is still saved, but the agent must say
  // immediately that it is not clearly visible.
  function captureVerdict(score, personVisible) {
    if (!personVisible) return { ok: false, level: 'missing' };
    if (score < 40) return { ok: false, level: 'unclear' };
    return { ok: true, level: 'good' };
  }

  function isLookQuestion(text) {
    return LOOK_RE.test(String(text || ''));
  }

  // Friendly small-talk: bare greetings and thanks get a reply mid-session.
  // Kept strict so vlog intros ("welcome to my channel") never misfire.
  var GREET_RE = /^(hi+|hii+|hello+|hey+|hey there|good morning|good afternoon|good evening|howdy|namaste|namastey)[\s!.]*$/i;
  var THANKS_RE = /^(thanks|thank you|thankyou|thanku|dhanyavadalu|dhanyavaadaalu|shukriya)[\s!.]*$/i;

  function isGreeting(text) {
    return GREET_RE.test(String(text || '').trim());
  }

  function isThanks(text) {
    return THANKS_RE.test(String(text || '').trim());
  }

  // Showing intent: "let me show you my room", "this is my kitchen", "room
  // tour". While showing a place, being out of frame is correct — the person
  // checks stay quiet. "Look at the lens" must NOT match (no place word).
  var SHOWING_RE = /\broom tour\b|\bhouse tour\b|\bhome tour\b|\b(show|shows|showing|showed|shown)(\s+you)?\s+(my\s+|the\s+|our\s+|this\s+)?(room|rooms|kitchen|house|home|setup|place|space|tour|bedroom|office|studio|balcony|around)\b|\b(look at|this is|here is|here's|check out|tour of)\s+(my\s+|the\s+|our\s+|this\s+)?(room|rooms|kitchen|house|home|setup|place|space|tour|bedroom|office|studio|balcony)\b/i;

  function isShowingContent(text) {
    return SHOWING_RE.test(String(text || ''));
  }

  // Whole-session tour mode from the occasion ("room tour vlog").
  function isTourSession(text) {
    return /\b(room|house|home|office|studio)\s*tour\b|\btour\s+of\b/i.test(String(text || ''));
  }

  // Talk button: tapping it must open the mic, never mute it — muting lives
  // on the "Listen to mic" checkbox. Returns 'enable' or 'confirm'.
  function talkAction(micState) {
    return micState === 'listening' ? 'confirm' : 'enable';
  }

  // Pixel helpers: pure functions over sampled values, so sessions measure
  // light, motion, and background calmness for real. Plain arrays in/out.
  function frameBrightness(luma) {
    if (!luma || !luma.length) return { mean: 120, verdict: 'good' };
    var sum = 0, i;
    for (i = 0; i < luma.length; i++) sum += luma[i];
    var mean = sum / luma.length;
    return { mean: Math.round(mean), verdict: mean < 50 ? 'dark' : mean > 205 ? 'washed' : 'good' };
  }

  function frameMotion(prev, curr) {
    if (!prev || !curr || !prev.length || prev.length !== curr.length) return { ratio: 0, moving: false };
    var changed = 0, i;
    for (i = 0; i < curr.length; i++) if (Math.abs(curr[i] - prev[i]) > 25) changed++;
    var ratio = changed / curr.length;
    return { ratio: Math.round(ratio * 100) / 100, moving: ratio > 0.08 };
  }

  function lumaVariance(luma) {
    if (!luma || !luma.length) return { variance: 0, busy: false };
    var mean = 0, i;
    for (i = 0; i < luma.length; i++) mean += luma[i];
    mean /= luma.length;
    var v = 0;
    for (i = 0; i < luma.length; i++) v += (luma[i] - mean) * (luma[i] - mean);
    v /= luma.length;
    return { variance: Math.round(v), busy: v > 2500 };
  }

  // Classic RGB skin rule over a flat [r,g,b,...] sample. Returns 0..1.
  function skinRatio(flat) {
    if (!flat || flat.length < 3) return 0;
    var skin = 0, n = 0, i, r, g, b;
    for (i = 0; i + 2 < flat.length; i += 3) {
      r = flat[i]; g = flat[i + 1]; b = flat[i + 2]; n++;
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15) skin++;
    }
    return n ? Math.round((skin / n) * 100) / 100 : 0;
  }

  // Mic echo guard: the laptop mic hears the app's own voice prompts, so mic
  // input is ignored for ~this long after the agent starts speaking — long
  // enough to cover the whole utterance (~15 chars/sec of speech plus
  // margin), so echo tails can never land as user input. The app shortens
  // the window to a beat the moment speech actually ends, which is what
  // protects prompt replies (a fixed short window ate them on long lines).
  function echoSuppressMs(text) {
    return Math.min(20000, 2500 + String(text || '').length * 90);
  }

  // No double-speak: a rule pause already said the fix out loud, so frame
  // alerts (missing-you, framing hints) stay logged-but-silent while the
  // gate owns the pause. Reminders and topic alerts always speak — they
  // carry news the pause voice never said.
  function holdAlertVoice(alertKey, rulePaused) {
    if (!rulePaused) return false;
    return alertKey === 'user-missing' || alertKey === 'framing';
  }

  // Mic watchdog: a recognition session that ends fast with zero finals, or
  // dies on audio-capture/network, means the mic hears nothing (grabbed by
  // another app, device gone). A long quiet session is just a quiet creator.
  var MIC_BARREN_MS = 3000;
  function micSessionBarren(opts) {
    opts = opts || {};
    if ((opts.finals || 0) > 0) return false;
    if (opts.lastError === 'audio-capture' || opts.lastError === 'network') return true;
    return (opts.elapsedMs || 0) < MIC_BARREN_MS;
  }

  // True when heard mic input looks like the agent's own recent speech coming
  // back through the speaker. Only long overlaps count, so a genuine short
  // command ("capture me") that echoes a recent prompt still gets through.
  function isLikelyEcho(heard, spoken) {
    function norm(s) {
      return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    var h = norm(heard), s = norm(spoken);
    if (!h || !s || Math.min(h.length, s.length) < 15) return false;
    return h.length >= s.length ? h.indexOf(s) !== -1 : s.indexOf(h) !== -1;
  }

  // Recorder helpers: pick a container that keeps mic audio (vp9 video +
  // opus audio when the browser allows it), and drop dead tracks before
  // mixing so one ended device never breaks the recording.
  function pickRecorderMime(isSupported) {
    var cands = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm'];
    for (var i = 0; i < cands.length; i++) {
      try {
        if (isSupported(cands[i])) return cands[i];
      } catch (e) { /* treat as unsupported */ }
    }
    return '';
  }

  function liveTracks(tracks) {
    return (tracks || []).filter(function (t) { return !!t && t.readyState !== 'ended'; });
  }

  // Vision gate: empty detections mean "no data yet", not "missing". Alerts,
  // auto-pause, and frame answers wait until the simulator or a loaded
  // on-camera detector is actually producing readings.
  function visionReady(simOn, cameraOn, hasModel) {
    return !!simOn || (!!cameraOn && !!hasModel);
  }

  // Siri-like voice policy: quiet mode speaks setup, issues, and direct
  // answers — never soft hints or routine confirmations.
  function voiceAllowed(mode, kind) {
    if (mode === 'full') return true;
    return kind !== 'hint' && kind !== 'routine';
  }

  function scorePhoto(m) {
    m = m || {};
    var center = Math.max(0, 1 - (m.centerOffset || 0) * 2.2);
    var size;
    if (m.area == null) size = 0.5;
    else if (m.area < 0.04) size = m.area / 0.04;
    else if (m.area > 0.65) size = Math.max(0, 1 - (m.area - 0.65) * 2);
    else size = 1;
    var light, br = m.brightness;
    if (br == null) light = 0.5;
    else if (br < 45) light = (br / 45) * 0.7;
    else if (br > 205) light = Math.max(0.2, 1 - (br - 205) / 50);
    else light = 1;
    var steady = 1 - Math.min(1, m.motion || 0);
    if (!m.personVisible) return Math.round(20 * light);
    var total = 0.35 * center + 0.2 * size + 0.25 * light + 0.2 * steady;
    if (light < 0.5) total *= (0.45 + light);
    return Math.round(100 * total);
  }

  return {
    TOPIC_TIMEOUT_MS: TOPIC_TIMEOUT_MS,
    ZOOM_IN_LEVEL: ZOOM_IN_LEVEL,
    FILL_ZOOM_MAX: FILL_ZOOM_MAX,
    DEFAULT_INGREDIENTS: DEFAULT_INGREDIENTS,
    CONTENT_TEMPLATES: CONTENT_TEMPLATES,
    RECIPE_KEYWORDS: RECIPE_KEYWORDS,
    TOPIC_KEYWORDS: RECIPE_KEYWORDS_ALL,
    VISUAL_TOPICS: VISUAL_TOPICS,
    normalizeText: normalizeText,
    mentionsSelf: mentionsSelf,
    getTemplate: getTemplate,
    listTemplates: listTemplates,
    suggestTemplate: suggestTemplate,
    setupIntent: setupIntent,
    parseLockReady: parseLockReady,
    isNewSessionRequest: isNewSessionRequest,
    isForgotQuery: isForgotQuery,
    photoRequiredNoun: photoRequiredNoun,
    isAgentParrot: isAgentParrot,
    parseChecklistEdit: parseChecklistEdit,
    parseAwayNotice: parseAwayNotice,
    isBackNotice: isBackNotice,
    detectMode: detectMode,
    photoOccasionLabel: photoOccasionLabel,
    photoSubject: photoSubject,
    photoShotList: photoShotList,
    suggestPhotoTips: suggestPhotoTips,
    parseRecordingCommand: parseRecordingCommand,
    parseCaptureCount: parseCaptureCount,
    isApproval: isApproval,
    captureVerdict: captureVerdict,
    isLookQuestion: isLookQuestion,
    isGreeting: isGreeting,
    isThanks: isThanks,
    talkAction: talkAction,
    isShowingContent: isShowingContent,
    isTourSession: isTourSession,
    frameBrightness: frameBrightness,
    frameMotion: frameMotion,
    lumaVariance: lumaVariance,
    skinRatio: skinRatio,
    scorePhoto: scorePhoto,
    voiceAllowed: voiceAllowed,
    echoSuppressMs: echoSuppressMs,
    isLikelyEcho: isLikelyEcho,
    holdAlertVoice: holdAlertVoice,
    micSessionBarren: micSessionBarren,
    pickRecorderMime: pickRecorderMime,
    liveTracks: liveTracks,
    visionReady: visionReady,
    keywordsForTemplate: keywordsForTemplate,
    checklistForTemplate: checklistForTemplate,
    findMentions: findMentions,
    isVisualTopic: isVisualTopic,
    findDetection: findDetection,
    isHeldNearFace: isHeldNearFace,
    personHalfOut: personHalfOut,
    stickySubject: stickySubject,
    answerLift: answerLift,
    nextPollDelay: nextPollDelay,
    presenceNeeded: presenceNeeded,
    recordingBlocked: recordingBlocked,
    suggestFocusObjects: suggestFocusObjects,
    isFocusableWord: isFocusableWord,
    checkVisibility: checkVisibility,
    analyzeFrame: analyzeFrame,
    ContentChecklist: ContentChecklist,
    RecipeChecklist: RecipeChecklist,
    TopicTracker: TopicTracker,
    ZoomController: ZoomController,
    GestureShutter: GestureShutter,
    RecordingPause: RecordingPause,
    HandWave: HandWave,
    AlertManager: AlertManager
  };
});
