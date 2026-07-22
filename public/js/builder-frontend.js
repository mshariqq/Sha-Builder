(function ($) {
    'use strict';

    var ShaBuilder = {
        postId: shaBuilderFrontend.postId,
        nonce: shaBuilderFrontend.nonce,
        ajaxUrl: shaBuilderFrontend.ajaxUrl,
        sections: [],
        globalCss: '',
        globalJs: '',
        currentSectionId: null,
        _history: [],
        _historyIndex: -1,
        _historyMax: 50,
        _elementOverrides: {},

        init: function () {
            this.loadSectionsData();
            this.buildModeBar();
            this.buildContextMenu();
            this.buildCodeModal();
            this.buildFloatingToolbar();
            this.addSectionEditButtons();
        },

        buildModeBar: function () {
            var bar = document.createElement('div');
            bar.className = 'sha-builder-mode-bar';
            bar.innerHTML = '<span>BUILDER MODE — Right-click any section or click <strong>Edit HTML</strong> button to edit code</span>';
            document.body.insertBefore(bar, document.body.firstChild);
            if (document.getElementById('wpadminbar')) {
                bar.style.top = '32px';
            }
        },

        loadSectionsData: function () {
            var $data = $('#sha-frontend-sections-data');
            if ($data.length) {
                try {
                    var parsed = JSON.parse($data.text());
                    this.sections = parsed.sections || [];
                    this.globalCss = parsed.globalCss || '';
                    this.globalJs = parsed.globalJs || '';
                    this._elementOverrides = parsed.element_overrides || {};
                    for (var i = 0; i < this.sections.length; i++) {
                        this.sections[i].phpDynamic = (this.sections[i].html || '').indexOf('<?php') !== -1;
                    }
                } catch (e) {
                    console.error('[Sha Builder] Failed to parse sections data', e);
                }
            }
        },

        getSectionIdFromElement: function ($el) {
            var $section = $el.closest('[data-section-id], [id^="sha-section-"]');
            if (!$section.length) return null;
            var id = $section.attr('data-section-id');
            if (id) return id;
            var fullId = $section.attr('id') || '';
            var match = fullId.match(/^sha-section-(.+)$/);
            if (match) return match[1];
            return null;
        },

        findSection: function (id) {
            for (var i = 0; i < this.sections.length; i++) {
                if (this.sections[i].id === id) return this.sections[i];
            }
            return null;
        },

        findSectionIndex: function (id) {
            for (var i = 0; i < this.sections.length; i++) {
                if (this.sections[i].id === id) return i;
            }
            return -1;
        },

        escHtml: function (str) {
            return $('<span>').text(str).html();
        },

        escAttr: function (str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        _captureSnapshot: function () {
            this._history = this._history.slice(0, this._historyIndex + 1);
            this._history.push(JSON.parse(JSON.stringify(this.sections)));
            if (this._history.length > this._historyMax) this._history.shift();
            this._historyIndex = this._history.length - 1;
        },

        undo: function () {
            if (this._historyIndex <= 0) return;
            this._historyIndex--;
            this.sections = JSON.parse(JSON.stringify(this._history[this._historyIndex]));
            this.saveAll(function () { location.reload(); });
        },

        redo: function () {
            if (this._historyIndex >= this._history.length - 1) return;
            this._historyIndex++;
            this.sections = JSON.parse(JSON.stringify(this._history[this._historyIndex]));
            this.saveAll(function () { location.reload(); });
        },

        buildElementSelector: function ($el) {
            var tag = $el.prop('tagName').toLowerCase();
            var id = $el.attr('id');
            var classes = ($el.attr('class') || '').trim().split(/\s+/).filter(Boolean);
            var sel = tag;
            if (id) sel += '#' + id.replace(/[^\w\-]/g, '\\$&');
            if (classes.length) sel += '.' + classes.map(function (c) { return c.replace(/[^\w\-]/g, '\\$&'); }).join('.');
            return sel;
        },

        /* ===========================================
           VISIBLE SECTION EDIT BUTTONS
           =========================================== */
        addSectionEditButtons: function () {
            var self = this;
            $('[data-section-id], [id^="sha-section-"]').each(function () {
                var $section = $(this);
                var id = self.getSectionIdFromElement($section);
                if (!id) return;
                if ($section.find('> .sha-section-edit-btn').length) return;
                var sec = self.findSection(id);
                var label = sec ? sec.label : 'Section';
                var $editBtn = $(
                    '<div class="sha-section-edit-btn" title="' + (sec && sec.phpDynamic ? 'PHP section — edit code only' : 'Edit section code') + '">'
                    + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
                    + '<span class="sha-section-edit-label">' + self.escHtml(label) + '</span>'
                    + (sec && sec.phpDynamic ? '<span class="sha-php-badge">PHP</span>' : '')
                    + '</div>'
                );
                $section.css('position', 'relative').append($editBtn);
            });
        },

        /* ===========================================
           CONTEXT MENU
           =========================================== */
        buildContextMenu: function () {
            var items = [
                { icon: '&#9998;', label: 'Edit HTML/CSS/JS', hint: 'Ctrl+E', action: 'editCode' },
                { icon: '&#9997;', label: 'Edit Content Inline', hint: '', action: 'editContent' },
                null,
                { icon: '+', label: 'Add Section Before', hint: '', action: 'addBefore' },
                { icon: '+', label: 'Add Section After', hint: '', action: 'addAfter' },
                { icon: '&#128203;', label: 'Duplicate Section', hint: 'Ctrl+D', action: 'duplicate' },
                null,
                { icon: '&#8593;', label: 'Move Up', hint: '', action: 'moveUp' },
                { icon: '&#8595;', label: 'Move Down', hint: '', action: 'moveDown' },
                null,
                { icon: '&#128465;', label: 'Remove Section', hint: 'Del', action: 'remove', danger: true },
            ];

            var html = '<div class="sha-context-menu" id="sha-context-menu">';
            for (var i = 0; i < items.length; i++) {
                if (items[i] === null) {
                    html += '<div class="sha-menu-separator"></div>';
                } else {
                    var item = items[i];
                    html += '<button class="sha-menu-item' + (item.danger ? ' danger' : '') + '" data-action="' + item.action + '">';
                    html += '<span class="menu-icon">' + item.icon + '</span>';
                    html += '<span class="menu-label">' + item.label + '</span>';
                    if (item.hint) html += '<span class="menu-hint">' + item.hint + '</span>';
                    html += '</button>';
                }
            }
            html += '</div>';
            $('body').append(html);
        },

        showContextMenu: function (x, y) {
            var $menu = $('#sha-context-menu');
            var sec = this.findSection(this.currentSectionId);
            $menu.find('[data-action="editContent"]').toggleClass('disabled', sec && sec.phpDynamic);
            $menu.css({ left: -9999, top: -9999 }).addClass('active');
            var mw = $menu.outerWidth();
            var mh = $menu.outerHeight();
            var maxX = window.innerWidth - mw - 4;
            var maxY = window.innerHeight - mh - 4;
            x = Math.max(4, Math.min(x, maxX));
            y = Math.max(4, Math.min(y, maxY));
            $menu.css({ left: x, top: y });
        },

        hideContextMenu: function () {
            $('#sha-context-menu').removeClass('active');
        },

        handleContextAction: function (action) {
            var id = this.currentSectionId;
            if (!id) { this.showToast('No section selected.', 'error'); return; }
            var idx = this.findSectionIndex(id);

            switch (action) {
                case 'editCode':
                    this.openCodeModal(id);
                    break;
                case 'editContent':
                    this.enableInlineEdit(id, this._contextTargetEl);
                    break;
                case 'editAttributes':
                    this.showToast('Attributes editor - coming soon', 'info');
                    break;
                case 'effects':
                    this.showToast('Effects panel - coming soon', 'info');
                    break;
                case 'moveUp':
                    if (idx > 0) this.moveSection(idx, idx - 1);
                    else this.showToast('Already at top.', 'info');
                    break;
                case 'moveDown':
                    if (idx < this.sections.length - 1) this.moveSection(idx, idx + 1);
                    else this.showToast('Already at bottom.', 'info');
                    break;
                case 'addBefore':
                    this.addSection(idx);
                    break;
                case 'addAfter':
                    this.addSection(idx + 1);
                    break;
                case 'duplicate':
                    this.duplicateSection(id);
                    break;
                case 'remove':
                    if (confirm('Remove this section?')) this.removeSection(id);
                    break;
            }
        },

        /* ===========================================
           FLOATING TOOLBAR
           =========================================== */
        buildFloatingToolbar: function () {
            var html = '<div class="sha-floating-toolbar" id="sha-floating-toolbar">'
                + '<span class="sha-toolbar-label">BUILDER</span>'
                + '<button data-action="addAfter" class="sha-tb-btn"><span class="sha-tb-icon">+</span>Add Section</button>'
                + '<div class="sha-toolbar-sep"></div>'
                + '<button data-action="saveAll" class="sha-tb-btn sha-tb-primary">'
                + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save</button>'
                + '<div class="sha-toolbar-sep"></div>'
                + '<button data-action="exitBuilder" class="sha-tb-btn sha-tb-exit">Exit</button>'
                + '</div>';
            $('body').append(html);
        },

        /* ===========================================
           CODE EDITOR MODAL
           =========================================== */
        buildCodeModal: function () {
            var html = '<div class="sha-modal-overlay-frontend" id="sha-code-modal">'
                + '<div class="sha-modal-box-frontend">'
                + '<div class="sha-modal-header-frontend">'
                + '<h3>Edit Code: <span class="sha-modal-section-label" id="sha-modal-section-label">Section</span></h3>'
                + '<button class="sha-modal-close-frontend" id="sha-modal-close-btn">&times;</button>'
                + '</div>'
                + '<div class="sha-code-tabs" id="sha-code-tabs">'
                + '<button class="sha-code-tab active" data-tab="html">HTML</button>'
                + '<button class="sha-code-tab" data-tab="css">CSS</button>'
                + '<button class="sha-code-tab" data-tab="js">JS</button>'
                + '</div>'
                + '<div class="sha-code-panel active" id="sha-code-panel-html">'
                + '<textarea id="sha-code-html" placeholder="Write HTML (PHP supported)..." spellcheck="false"></textarea>'
                + '</div>'
                + '<div class="sha-code-panel" id="sha-code-panel-css">'
                + '<textarea id="sha-code-css" placeholder="/* Write CSS here */" spellcheck="false"></textarea>'
                + '</div>'
                + '<div class="sha-code-panel" id="sha-code-panel-js">'
                + '<textarea id="sha-code-js" placeholder="// Write JavaScript here" spellcheck="false"></textarea>'
                + '</div>'
                + '<div class="sha-modal-footer-frontend">'
                + '<button class="sha-btn sha-btn-cancel" id="sha-code-cancel">Cancel</button>'
                + '<button class="sha-btn sha-btn-primary" id="sha-code-save">Save &amp; Refresh</button>'
                + '</div>'
                + '</div>'
                + '</div>'
                + '<div id="sha-toast-container"></div>';
            $('body').append(html);
        },

        openCodeModal: function (sectionId) {
            var sec = this.findSection(sectionId);
            if (!sec) { this.showToast('Section data not loaded.', 'error'); return; }
            $('#sha-code-html').val(sec.html || '');
            $('#sha-code-css').val(sec.css || '');
            $('#sha-code-js').val(sec.js || '');
            $('#sha-modal-section-label').text(sec.label || 'Section');
            this._editingSectionId = sectionId;
            $('#sha-code-tabs .sha-code-tab').first().trigger('click');
            $('#sha-code-modal').addClass('active');
        },

        hideCodeModal: function () {
            $('#sha-code-modal').removeClass('active');
            this._editingSectionId = null;
        },

        splitSectionCode: function (html) {
            var protectedRanges = [];
            var phpRe = /<\?php[\s\S]*?\?>/g;
            var m;
            while ((m = phpRe.exec(html)) !== null) {
                protectedRanges.push({ s: m.index, e: m.index + m[0].length });
            }
            function isProtected(idx) {
                for (var i = 0; i < protectedRanges.length; i++) {
                    if (idx >= protectedRanges[i].s && idx < protectedRanges[i].e) return true;
                }
                return false;
            }
            var positions = [];
            var tagRe = /<section(\s[^>]*)?>/gi;
            while ((m = tagRe.exec(html)) !== null) {
                if (!isProtected(m.index)) positions.push(m.index);
            }
            if (positions.length <= 1) return [html];
            var parts = [];
            var before = html.substring(0, positions[0]).trim();
            if (before) parts.push(before);
            for (var i = 0; i < positions.length; i++) {
                var start = positions[i];
                var end = i + 1 < positions.length ? positions[i + 1] : html.length;
                parts.push(html.substring(start, end).trim());
            }
            return parts;
        },

        saveCodeFromModal: function () {
            var sectionId = this._editingSectionId;
            if (!sectionId) return;
            var idx = this.findSectionIndex(sectionId);
            if (idx === -1) return;
            this._captureSnapshot();
            var html = $('#sha-code-html').val() || '';
            var parts = this.splitSectionCode(html);
            this.sections[idx].html = parts[0];
            this.sections[idx].css = $('#sha-code-css').val() || '';
            this.sections[idx].js = $('#sha-code-js').val() || '';
            if (parts.length > 1) {
                for (var i = 1; i < parts.length; i++) {
                    var newSec = {
                        id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        label: 'Section',
                        html: parts[i],
                        css: '',
                        js: ''
                    };
                    this.sections.splice(idx + i, 0, newSec);
                }
            }
            this.saveAll(function () {
                location.reload();
            });
        },

        /* ===========================================
           SECTION OPERATIONS
           =========================================== */
        addSection: function (atIndex) {
            this._captureSnapshot();
            var id = 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            var newSec = {
                id: id,
                label: 'New Section',
                html: '<div style="padding:40px;text-align:center;color:#999;">New section</div>',
                css: '',
                js: ''
            };
            this.sections.splice(atIndex, 0, newSec);
            this.saveAll(function () { location.reload(); });
        },

        duplicateSection: function (id) {
            var sec = this.findSection(id);
            if (!sec) return;
            var idx = this.findSectionIndex(id);
            this._captureSnapshot();
            var clone = $.extend(true, {}, sec);
            clone.id = 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            clone.label = (sec.label || 'Section') + ' (copy)';
            this.sections.splice(idx + 1, 0, clone);
            this.saveAll(function () { location.reload(); });
        },

        removeSection: function (id) {
            if (this.sections.length <= 1) {
                this.showToast('Cannot remove the last section.', 'error');
                return;
            }
            var idx = this.findSectionIndex(id);
            if (idx === -1) return;
            this._captureSnapshot();
            this.sections.splice(idx, 1);
            this.saveAll(function () { location.reload(); });
        },

        moveSection: function (fromIdx, toIdx) {
            if (fromIdx === toIdx) return;
            this._captureSnapshot();
            var item = this.sections.splice(fromIdx, 1)[0];
            this.sections.splice(toIdx, 0, item);
            this.saveAll(function () { location.reload(); });
        },

        /* ===========================================
           ELEMENT PROPERTIES (type-aware)
           =========================================== */
        elementProps: {
            '*': { label: 'Element', attrs: ['id', 'class', 'title'] },
            'a': { label: 'Link', attrs: ['href', 'target', 'rel', 'title', 'download'] },
            'img': { label: 'Image', attrs: ['src', 'alt', 'width', 'height', 'loading', 'srcset'] },
            'input': { label: 'Input', attrs: ['type', 'placeholder', 'value', 'name', 'required', 'disabled', 'min', 'max', 'step'] },
            'button': { label: 'Button', attrs: ['type', 'disabled', 'name', 'value'] },
            'textarea': { label: 'Textarea', attrs: ['placeholder', 'rows', 'cols', 'disabled', 'maxlength'] },
            'select': { label: 'Select', attrs: ['name', 'disabled', 'multiple'] },
            'form': { label: 'Form', attrs: ['action', 'method', 'enctype', 'target'] },
            'video': { label: 'Video', attrs: ['src', 'controls', 'autoplay', 'loop', 'muted', 'poster', 'width', 'height'] },
            'audio': { label: 'Audio', attrs: ['src', 'controls', 'autoplay', 'loop'] },
            'iframe': { label: 'Iframe', attrs: ['src', 'width', 'height', 'allow', 'loading', 'title'] },
            'source': { label: 'Source', attrs: ['src', 'type', 'media', 'srcset'] },
            'svg': { label: 'SVG', attrs: ['viewBox', 'width', 'height'] },
            'path': { label: 'Path', attrs: ['d', 'fill', 'stroke', 'stroke-width', 'opacity'] },
            'circle': { label: 'Circle', attrs: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'] },
            'rect': { label: 'Rect', attrs: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'] },
            'line': { label: 'Line', attrs: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'] },
            'polyline': { label: 'Polyline', attrs: ['points', 'fill', 'stroke'] },
            'polygon': { label: 'Polygon', attrs: ['points', 'fill', 'stroke'] },
            'text': { label: 'Text', attrs: ['x', 'y', 'fill', 'font-size', 'text-anchor'] },
            'use': { label: 'Use', attrs: ['href', 'x', 'y'] },
            'g': { label: 'Group', attrs: ['fill', 'stroke', 'opacity', 'transform'] },
            'h1': { label: 'Heading 1', attrs: ['id', 'class', 'style'] },
            'h2': { label: 'Heading 2', attrs: ['id', 'class', 'style'] },
            'h3': { label: 'Heading 3', attrs: ['id', 'class', 'style'] },
            'h4': { label: 'Heading 4', attrs: ['id', 'class', 'style'] },
            'h5': { label: 'Heading 5', attrs: ['id', 'class', 'style'] },
            'h6': { label: 'Heading 6', attrs: ['id', 'class', 'style'] },
            'p': { label: 'Paragraph', attrs: ['id', 'class', 'style'] },
            'span': { label: 'Span', attrs: ['id', 'class', 'style', 'title'] },
            'div': { label: 'Div', attrs: ['id', 'class', 'style'] },
            'ul': { label: 'List', attrs: ['id', 'class', 'style'] },
            'ol': { label: 'Ordered List', attrs: ['id', 'class', 'style', 'type', 'start'] },
            'li': { label: 'Item', attrs: ['id', 'class', 'style', 'value'] },
            'table': { label: 'Table', attrs: ['id', 'class', 'style', 'border'] },
            'tr': { label: 'Row', attrs: ['id', 'class', 'style'] },
            'td': { label: 'Cell', attrs: ['id', 'class', 'style', 'colspan', 'rowspan'] },
            'th': { label: 'Header Cell', attrs: ['id', 'class', 'style', 'scope', 'colspan', 'rowspan'] },
            'label': { label: 'Label', attrs: ['id', 'class', 'style', 'for'] },
            'blockquote': { label: 'Quote', attrs: ['id', 'class', 'style', 'cite'] },
            'code': { label: 'Code', attrs: ['id', 'class', 'style'] },
            'pre': { label: 'Preformatted', attrs: ['id', 'class', 'style'] },
            'hr': { label: 'Divider', attrs: ['id', 'class', 'style'] },
            'section': { label: 'Section', attrs: ['id', 'class', 'style'] },
            'article': { label: 'Article', attrs: ['id', 'class', 'style'] },
            'nav': { label: 'Nav', attrs: ['id', 'class', 'style'] },
            'aside': { label: 'Aside', attrs: ['id', 'class', 'style'] },
            'header': { label: 'Header', attrs: ['id', 'class', 'style'] },
            'footer': { label: 'Footer', attrs: ['id', 'class', 'style'] },
            'main': { label: 'Main', attrs: ['id', 'class', 'style'] },
            'figure': { label: 'Figure', attrs: ['id', 'class', 'style'] },
            'figcaption': { label: 'Caption', attrs: ['id', 'class', 'style'] },
            'details': { label: 'Details', attrs: ['id', 'class', 'style', 'open'] },
            'summary': { label: 'Summary', attrs: ['id', 'class', 'style'] },
            'dialog': { label: 'Dialog', attrs: ['id', 'class', 'style', 'open'] },
            'time': { label: 'Time', attrs: ['id', 'class', 'style', 'datetime'] },
            'abbr': { label: 'Abbreviation', attrs: ['id', 'class', 'style', 'title'] },
            'data': { label: 'Data', attrs: ['id', 'class', 'style', 'value'] },
            'meter': { label: 'Meter', attrs: ['id', 'class', 'value', 'min', 'max', 'low', 'high', 'optimum'] },
            'progress': { label: 'Progress', attrs: ['id', 'class', 'value', 'max'] },
            'canvas': { label: 'Canvas', attrs: ['id', 'class', 'width', 'height'] },
            'picture': { label: 'Picture', attrs: ['id', 'class', 'style'] },
            'map': { label: 'Map', attrs: ['id', 'name'] },
            'area': { label: 'Area', attrs: ['alt', 'coords', 'href', 'shape', 'target'] },
        },

        getElementProps: function (tag) {
            tag = tag.toLowerCase();
            return this.elementProps[tag] || this.elementProps['*'];
        },

        getEffectiveCSS: function ($el, prop) {
            var inline = $el[0].style.getPropertyValue(prop);
            if (inline) return inline;
            var comp = window.getComputedStyle($el[0]);
            var val = comp.getPropertyValue(prop);
            var defaults = {
                'margin-top': '0px', 'margin-right': '0px', 'margin-bottom': '0px', 'margin-left': '0px',
                'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
                'border-width': '0px', 'border-style': 'none', 'border-radius': '0px', 'border-color': 'rgb(0, 0, 0)',
                'background-image': 'none', 'background-size': 'auto', 'background-repeat': 'repeat',
                'text-decoration': 'none', 'text-transform': 'none',
                'font-style': 'normal', 'font-weight': '400',
                'letter-spacing': 'normal', 'white-space': 'normal',
                'overflow': 'visible', 'position': 'static',
                'opacity': '1', 'transform': 'none', 'box-shadow': 'none', 'filter': 'none',
                'width': 'auto', 'height': 'auto',
                'min-width': 'auto', 'min-height': 'auto', 'max-width': 'none', 'max-height': 'none',
                'top': 'auto', 'right': 'auto', 'bottom': 'auto', 'left': 'auto', 'z-index': 'auto',
                'flex-direction': 'row', 'flex-wrap': 'nowrap', 'gap': 'normal',
                'transition': 'all 0s ease 0s',
                'background-color': 'rgba(0, 0, 0, 0)',
            };
            if (!val) return '';
            if (defaults[prop] !== undefined) {
                if (val === defaults[prop]) return '';
                if (prop === 'background-color' && (val === 'transparent' || val === 'rgba(0,0,0,0)')) return '';
                if (prop === 'word-spacing' && (val === '0px' || val === 'normal')) return '';
            }
            return val;
        },

        /* ===========================================
           CSS CLASS AUTOCOMPLETE
           =========================================== */
        _cachedClasses: null,

        getAvailableClasses: function () {
            if (this._cachedClasses) return this._cachedClasses;
            var classes = {};
            try {
                for (var si = 0; si < document.styleSheets.length; si++) {
                    var sheet = document.styleSheets[si];
                    var rules;
                    try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
                    if (!rules) continue;
                    for (var ri = 0; ri < rules.length; ri++) {
                        var rule = rules[ri];
                        if (rule.selectorText) {
                            var parts = rule.selectorText.split(',');
                            for (var pi = 0; pi < parts.length; pi++) {
                                var sel = parts[pi].trim();
                                var m = sel.match(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g);
                                if (m) {
                                    for (var mi = 0; mi < m.length; mi++) {
                                        classes[m[mi].substring(1)] = true;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {}
            this._cachedClasses = Object.keys(classes).sort();
            return this._cachedClasses;
        },

        showClassAutocomplete: function ($input) {
            var self = this;
            var existing = this._classAutocompleteActive;
            if (existing && existing[0] === $input[0]) return;
            if (existing) this.hideClassAutocomplete();

            var available = this.getAvailableClasses();
            var $dropdown = $('<div class="sha-class-autocomplete" tabindex="-1"/>');
            $('body').append($dropdown);
            this._classAutocompleteActive = [$input[0], $dropdown];

            function position() {
                var off = $input.offset();
                var h = $input.outerHeight();
                var iw = $input.outerWidth();
                $dropdown.css({
                    top: off.top + h + 2,
                    left: off.left,
                    minWidth: Math.max(iw, 180),
                    maxWidth: Math.max(iw, 320),
                    maxHeight: 240
                });
            }

            function filter() {
                var val = $input.val() || '';
                var current = val.split(/\s+/).filter(Boolean);
                var prefix = current.length > 0 ? current[current.length - 1] : '';
                if (!prefix || prefix.length < 1) { $dropdown.empty().hide(); return; }
                var matches = [];
                for (var i = 0; i < available.length; i++) {
                    if (available[i].toLowerCase().indexOf(prefix.toLowerCase()) === 0
                        && current.indexOf(available[i]) === -1) {
                        matches.push(available[i]);
                    }
                }
                if (!matches.length) { $dropdown.empty().hide(); return; }
                var html = '';
                for (var j = 0; j < Math.min(matches.length, 30); j++) {
                    html += '<div class="sha-class-autocomplete-item" data-class="' + matches[j] + '">'
                        + '.' + matches[j] + '</div>';
                }
                $dropdown.html(html).show();
                position();
            }

            $input.on('input.shaAutocomplete', filter);
            $input.on('focus.shaAutocomplete', filter);
            $input.on('blur.shaAutocomplete', function () {
                setTimeout(function () { self.hideClassAutocomplete(); }, 180);
            });

            $dropdown.on('mousedown', '.sha-class-autocomplete-item', function (e) {
                e.preventDefault();
                var cls = $(this).data('class');
                var val = $input.val() || '';
                var parts = val.split(/\s+/).filter(Boolean);
                parts[parts.length - 1] = cls;
                $input.val(parts.join(' '));
                $input.trigger('input');
                self.hideClassAutocomplete();
                $input.focus();
            });

            filter();
        },

        hideClassAutocomplete: function () {
            if (this._classAutocompleteActive) {
                var $input = $(this._classAutocompleteActive[0]);
                $input.off('.shaAutocomplete');
                $(this._classAutocompleteActive[1]).remove();
                this._classAutocompleteActive = null;
            }
        },

        /* ===========================================
           ELEMENT INSPECTOR MODE
           =========================================== */
        enableInlineEdit: function (id, $targetEl) {
            if (this._inspectActive) {
                this.disableInlineEdit();
                if (this._inspectSectionId === id) return;
            }
            var sec = this.findSection(id);
            if (sec && sec.phpDynamic) {
                this.showToast('PHP dynamic content cannot be edited inline.', 'error');
                return;
            }
            var $section = $('[data-section-id="' + id + '"], #sha-section-' + id);
            if (!$section.length) return;
            this._inspectActive = true;
            this._inspectSectionId = id;
            this._inspectSectionEl = $section;
            this._inspectOriginalHtml = $section.html();
            $section.addClass('sha-inspecting');
            this.buildInspectBar(id);
            this.buildPropertiesPanel();
            if ($targetEl && $targetEl.length) {
                this.selectElement($targetEl);
                this.showToast('Edit element properties. Click another element to inspect, Esc to cancel.', 'info');
            } else {
                this.showToast('Click any element to edit its properties. Esc to cancel.', 'info');
            }
            var self = this;
            $(window).on('scroll.shaInspect resize.shaInspect', function () {
                self._updateOverlayPosition();
            });
            /* native capturing listeners to intercept <a> clicks before they bubble */
            this._inspectPreventHandler = function (ce) {
                if (!self._inspectActive) return;
                if ($(ce.target).is('a') || $(ce.target).closest('a').length) {
                    ce.preventDefault();
                }
            };
            this._inspectSelectHandler = function (ce) {
                if (!self._inspectActive) return;
                var $ct = $(ce.target);
                if ($ct.is('a') || $ct.closest('a').length) {
                    ce.preventDefault();
                    self.selectElement($ct);
                }
            };
            document.addEventListener('mousedown', this._inspectPreventHandler, true);
            document.addEventListener('click', this._inspectSelectHandler, true);
        },

        disableInlineEdit: function () {
            this._inspectActive = false;
            this._inspectSectionId = null;
            this._inspectOriginalHtml = null;
            this._selectedEl = null;
            this._hoveredEl = null;
            if (this._classAutocompleteTimer) {
                clearTimeout(this._classAutocompleteTimer);
                this._classAutocompleteTimer = null;
            }
            if (this._inspectSectionEl) {
                this._inspectSectionEl.removeClass('sha-inspecting');
                this._inspectSectionEl = null;
            }
            if (this._inspectPreventHandler) {
                document.removeEventListener('mousedown', this._inspectPreventHandler, true);
                this._inspectPreventHandler = null;
            }
            if (this._inspectSelectHandler) {
                document.removeEventListener('click', this._inspectSelectHandler, true);
                this._inspectSelectHandler = null;
            }
            this.hideClassAutocomplete();
            this.removeInspectOverlay();
            $(window).off('scroll.shaInspect resize.shaInspect');
            $('#sha-inspect-bar').remove();
            $('#sha-props-panel').remove();
        },

        /* ---- element hover/click ---- */
        removeInspectOverlay: function () {
            if (this._inspectOverlayEl) {
                this._inspectOverlayEl.remove();
                this._inspectOverlayEl = null;
            }
        },

        showInspectOverlay: function ($el) {
            this.removeInspectOverlay();
            if (!$el || !$el.length) return;
            var rect = $el[0].getBoundingClientRect();
            var tag = $el.prop('tagName').toLowerCase();
            var props = this.getElementProps(tag);
            var label = props.label + ' <' + tag + '>';
            var overlay = $(
                '<div class="sha-inspect-overlay" id="sha-inspect-overlay">'
                + '<div class="sha-inspect-tag">' + label + '</div>'
                + '</div>'
            );
            overlay.css({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
            $('body').append(overlay);
            this._inspectOverlayEl = overlay;
        },

        _updateOverlayPosition: function () {
            var $el = this._selectedEl || this._hoveredEl;
            if ($el && $el.length) {
                this.showInspectOverlay($el);
            }
        },

        selectElement: function ($el) {
            if (!$el || !$el.length) return;
            if ($el.closest('#sha-props-panel, #sha-inspect-bar, .sha-floating-toolbar').length) return;
            if ($el.closest('.sha-section-edit-btn').length) return;
            if (!$el.closest('[data-section-id], [id^="sha-section-"]').length) return;
            this._selectedEl = $el;
            this.showInspectOverlay($el);
            this.populatePropertiesPanel($el);
        },

        commitInlineEdit: function () {
            if (!this._inspectSectionId || !this._inspectSectionEl) return;
            var newHtml = this._inspectSectionEl.html();
            var sec = this.findSection(this._inspectSectionId);
            if (sec) sec.html = newHtml;
        },

        saveInlineEdit: function () {
            var $el = this._selectedEl;
            if ($el) this.applyPropsToElement($el);
            this.commitInlineEdit();
            this.disableInlineEdit();
            this.saveAll(function () { location.reload(); });
        },

        cancelInlineEdit: function () {
            if (this._inspectSectionEl && this._inspectOriginalHtml !== null) {
                this._inspectSectionEl.html(this._inspectOriginalHtml);
            }
            this.disableInlineEdit();
        },

        /* ---- properties panel ---- */
        buildPropertiesPanel: function () {
            var html = '<div class="sha-props-panel" id="sha-props-panel">'
                + '<div class="sha-props-header">'
                + '<span class="sha-props-title">Properties</span>'
                + '<button class="sha-props-close" id="sha-props-close">&times;</button>'
                + '</div>'
                + '<div class="sha-props-tabs">'
                + '<button class="sha-props-tab active" data-ptab="attrs">Attributes</button>'
                + '<button class="sha-props-tab" data-ptab="style">Style</button>'
                + '<button class="sha-props-tab" data-ptab="effects">Effects</button>'
                + '</div>'
                + '<div class="sha-props-body">'
                + '<div class="sha-props-content active" id="sha-props-attrs"><div class="sha-props-empty">Click an element to inspect</div></div>'
                + '<div class="sha-props-content" id="sha-props-style"><div class="sha-props-empty">Select an element first</div></div>'
                + '<div class="sha-props-content" id="sha-props-effects"><div class="sha-props-empty">Select an element first</div></div>'
                + '</div>'
                + '<div class="sha-props-footer">'
                + '<button class="sha-btn sha-btn-cancel" id="sha-props-cancel">Cancel</button>'
                + '<button class="sha-btn sha-btn-primary" id="sha-props-save">Save Element</button>'
                + '</div>'
                + '</div>';
            $('body').append(html);
        },

        populatePropertiesPanel: function ($el) {
            var tag = $el.prop('tagName').toLowerCase();
            var props = this.getElementProps(tag);
            var commonAttrs = ['id', 'class', 'title', 'style'];
            var specificAttrs = [];

            $.each(props.attrs, function (i, a) {
                if ($.inArray(a, commonAttrs) === -1) specificAttrs.push(a);
            });

            var attrsHtml = '';
            if (specificAttrs.length) {
                attrsHtml += '<div class="sha-props-group"><div class="sha-props-group-title">Element <' + tag + '></div>';
                $.each(specificAttrs, function (i, a) {
                    var val = $el.attr(a) || '';
                    attrsHtml += '<label class="sha-props-field">'
                        + '<span>' + a + '</span>'
                        + '<input type="text" data-attr="' + a + '" value="' + ShaBuilder.escHtml(val) + '" />'
                        + '</label>';
                });
                attrsHtml += '</div>';
            }

            attrsHtml += '<div class="sha-props-group"><div class="sha-props-group-title">Common</div>';
            $.each(commonAttrs, function (i, a) {
                var val = a === 'style' ? ($el.attr('style') || '') : ($el.attr(a) || '');
                var extraClass = a === 'class' ? ' sha-class-autocomplete-trigger' : '';
                if (a === 'style') {
                    attrsHtml += '<label class="sha-props-field sha-props-field-wide">'
                        + '<span>' + a + '</span>'
                        + '<input type="text" data-attr="' + a + '" value="' + ShaBuilder.escHtml(val) + '" placeholder="color:red;font-size:16px" />'
                        + '</label>';
                } else {
                    attrsHtml += '<label class="sha-props-field">'
                        + '<span>' + a + '</span>'
                        + '<input type="text" data-attr="' + a + '" class="' + extraClass + '" value="' + ShaBuilder.escHtml(val) + '" />'
                        + '</label>';
                }
            });
            attrsHtml += '</div>';

            /* text content */
            var textContent = '';
            $el.contents().each(function () {
                if (this.nodeType === 3) textContent += this.nodeValue;
            });
            attrsHtml += '<div class="sha-props-group"><div class="sha-props-group-title">Text Content</div>'
                + '<label class="sha-props-field sha-props-field-wide">'
                + '<span>Content</span>'
                + '<textarea data-text="content" class="sha-props-text-content" rows="3" placeholder="Element text content...">' + ShaBuilder.escHtml(textContent) + '</textarea>'
                + '</label>'
                + '</div>';

            $('#sha-props-attrs').html(attrsHtml);

            if (this._classAutocompleteTimer) {
                clearTimeout(this._classAutocompleteTimer);
                this._classAutocompleteTimer = null;
            }
            this.hideClassAutocomplete();
            var $classInput = $('#sha-props-attrs .sha-class-autocomplete-trigger');
            if ($classInput.length) {
                this._classAutocompleteTimer = setTimeout(function () { ShaBuilder.showClassAutocomplete($classInput); }, 50);
            }

            /* ---- style tab (using getComputedStyle) ---- */
            var cssGroups = [
                {
                    title: 'Typography',
                    fields: [
                        { prop: 'color', type: 'color', label: 'Color' },
                        { prop: 'font-family', type: 'text', label: 'Font Family' },
                        { prop: 'font-size', type: 'text', label: 'Font Size' },
                        { prop: 'font-weight', type: 'select', options: ['100','200','300','400','500','600','700','800','900','normal','bold','lighter','bolder'], label: 'Font Weight' },
                        { prop: 'font-style', type: 'select', options: ['normal','italic','oblique'], label: 'Font Style' },
                        { prop: 'line-height', type: 'text', label: 'Line Height' },
                        { prop: 'text-align', type: 'select', options: ['left','center','right','justify'], label: 'Text Align' },
                        { prop: 'text-decoration', type: 'select', options: ['none','underline','overline','line-through'], label: 'Text Decoration' },
                        { prop: 'text-transform', type: 'select', options: ['none','uppercase','lowercase','capitalize'], label: 'Text Transform' },
                        { prop: 'letter-spacing', type: 'text', label: 'Letter Spacing' },
                        { prop: 'word-spacing', type: 'text', label: 'Word Spacing' },
                        { prop: 'white-space', type: 'select', options: ['normal','nowrap','pre','pre-wrap','pre-line'], label: 'White Space' },
                    ]
                },
                {
                    title: 'Background',
                    fields: [
                        { prop: 'background-color', type: 'color', label: 'Background Color' },
                        { prop: 'background-image', type: 'text', label: 'Background Image' },
                        { prop: 'background-size', type: 'select', options: ['auto','cover','contain','100%'], label: 'Background Size' },
                        { prop: 'background-position', type: 'text', label: 'Background Position' },
                        { prop: 'background-repeat', type: 'select', options: ['repeat','no-repeat','repeat-x','repeat-y'], label: 'Background Repeat' },
                    ]
                },
                {
                    title: 'Margin',
                    fields: [
                        { prop: 'margin-top', type: 'text', label: 'Top' },
                        { prop: 'margin-right', type: 'text', label: 'Right' },
                        { prop: 'margin-bottom', type: 'text', label: 'Bottom' },
                        { prop: 'margin-left', type: 'text', label: 'Left' }
                    ]
                },
                {
                    title: 'Padding',
                    fields: [
                        { prop: 'padding-top', type: 'text', label: 'Top' },
                        { prop: 'padding-right', type: 'text', label: 'Right' },
                        { prop: 'padding-bottom', type: 'text', label: 'Bottom' },
                        { prop: 'padding-left', type: 'text', label: 'Left' }
                    ]
                },
                {
                    title: 'Border',
                    fields: [
                        { prop: 'border-radius', type: 'text', label: 'Border Radius' },
                        { prop: 'border-width', type: 'text', label: 'Border Width' },
                        { prop: 'border-style', type: 'select', options: ['none','solid','dashed','dotted','double','groove','ridge','inset','outset'], label: 'Border Style' },
                        { prop: 'border-color', type: 'color', label: 'Border Color' },
                    ]
                },
                {
                    title: 'Layout & Sizing',
                    fields: [
                        { prop: 'display', type: 'select', options: ['block','flex','inline','inline-block','grid','none','contents','flow-root'], label: 'Display' },
                        { prop: 'width', type: 'text', label: 'Width' },
                        { prop: 'height', type: 'text', label: 'Height' },
                        { prop: 'min-width', type: 'text', label: 'Min Width' },
                        { prop: 'min-height', type: 'text', label: 'Min Height' },
                        { prop: 'max-width', type: 'text', label: 'Max Width' },
                        { prop: 'max-height', type: 'text', label: 'Max Height' },
                        { prop: 'overflow', type: 'select', options: ['visible','hidden','scroll','auto'], label: 'Overflow' },
                        { prop: 'position', type: 'select', options: ['static','relative','absolute','fixed','sticky'], label: 'Position' },
                        { prop: 'top', type: 'text', label: 'Top' },
                        { prop: 'right', type: 'text', label: 'Right' },
                        { prop: 'bottom', type: 'text', label: 'Bottom' },
                        { prop: 'left', type: 'text', label: 'Left' },
                        { prop: 'z-index', type: 'text', label: 'Z-Index' },
                        { prop: 'flex-direction', type: 'select', options: ['row','column','row-reverse','column-reverse'], label: 'Flex Direction' },
                        { prop: 'flex-wrap', type: 'select', options: ['nowrap','wrap','wrap-reverse'], label: 'Flex Wrap' },
                        { prop: 'align-items', type: 'select', options: ['flex-start','flex-end','center','stretch','baseline'], label: 'Align Items' },
                        { prop: 'justify-content', type: 'select', options: ['flex-start','flex-end','center','space-between','space-around','space-evenly'], label: 'Justify Content' },
                        { prop: 'gap', type: 'text', label: 'Gap' },
                    ]
                },
                {
                    title: 'Effects',
                    fields: [
                        { prop: 'opacity', type: 'range', min: 0, max: 1, step: 0.05, label: 'Opacity' },
                        { prop: 'cursor', type: 'select', options: ['auto','default','pointer','grab','move','not-allowed','text','wait','crosshair','help'], label: 'Cursor' },
                        { prop: 'box-shadow', type: 'text', label: 'Box Shadow' },
                        { prop: 'transform', type: 'text', label: 'Transform' },
                        { prop: 'transition', type: 'text', label: 'Transition' },
                        { prop: 'filter', type: 'text', label: 'Filter' },
                    ]
                }
            ];

            var compStyle = window.getComputedStyle($el[0]);
            var inlineStyleStr = $el.attr('style') || '';

            var styleHtml = '';
            for (var gi = 0; gi < cssGroups.length; gi++) {
                var group = cssGroups[gi];
                styleHtml += '<div class="sha-props-group"><div class="sha-props-group-title">' + group.title + '</div>';
                for (var fi = 0; fi < group.fields.length; fi++) {
                    var f = group.fields[fi];
                    var val = ShaBuilder.getEffectiveCSS($el, f.prop);
                    var displayVal = val;
                    var escVal = ShaBuilder.escHtml(val);
                    if (f.type === 'select') {
                        var opts = '<option value="">&mdash;</option>';
                        for (var oi = 0; oi < f.options.length; oi++) {
                            var opt = f.options[oi];
                            opts += '<option value="' + opt + '"' + (val === opt ? ' selected' : '') + '>' + opt + '</option>';
                        }
                        styleHtml += '<label class="sha-props-field">'
                            + '<span>' + f.label + '</span>'
                            + '<select data-css="' + f.prop + '" data-original="' + ShaBuilder.escAttr(val) + '">' + opts + '</select>'
                            + '</label>';
                    } else if (f.type === 'color') {
                        var hex = val;
                        if (val && !/^#[0-9a-f]{3,6}$/i.test(hex)) {
                            var t = document.createElement('input');
                            t.type = 'color';
                            try { t.value = val; hex = t.value; } catch(e) { hex = ''; }
                        }
                        var dispHex = hex || '';
                        styleHtml += '<label class="sha-props-field">'
                            + '<span>' + f.label + '</span>'
                            + '<div class="sha-field-row" style="flex:1;display:flex;gap:4px;">'
                            + '<input type="text" data-css="' + f.prop + '" data-original="' + ShaBuilder.escAttr(val) + '" value="' + escVal + '" placeholder="' + f.label + '" style="flex:1;min-width:0;" />'
                            + '<input type="color" class="sha-css-color-picker" value="' + (dispHex || '#000000') + '" style="width:28px;height:28px;padding:0;border:1px solid #2d2d44;border-radius:4px;cursor:pointer;" />'
                            + '</div>'
                            + '</label>';
                    } else if (f.type === 'range') {
                        var rNum;
                        if (val) {
                            rNum = parseFloat(val);
                            if (isNaN(rNum)) rNum = f.max;
                        } else {
                            var rawComp = compStyle.getPropertyValue(f.prop);
                            rNum = parseFloat(rawComp);
                            if (isNaN(rNum)) rNum = f.max;
                        }
                        var rDisplay = val || '';
                        styleHtml += '<label class="sha-props-field">'
                            + '<span>' + f.label + '</span>'
                            + '<div class="sha-field-row" style="flex:1;display:flex;gap:4px;align-items:center;">'
                            + '<input type="range" data-css="' + f.prop + '" data-original="' + ShaBuilder.escAttr(rDisplay) + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + rNum + '" style="flex:1;" />'
                            + '<span class="sha-range-label">' + rNum + '</span>'
                            + '</div>'
                            + '</label>';
                    } else {
                        styleHtml += '<label class="sha-props-field">'
                            + '<span>' + f.label + '</span>'
                            + '<input type="text" data-css="' + f.prop + '" data-original="' + ShaBuilder.escAttr(val) + '" value="' + escVal + '" placeholder="' + f.label + '" />'
                            + '</label>';
                    }
                }
                styleHtml += '</div>';
            }

            /* custom CSS textarea with the full inline style */
            styleHtml += '<div class="sha-props-group"><div class="sha-props-group-title">Custom CSS</div>'
                + '<textarea class="sha-props-custom-css" id="sha-props-custom-css" placeholder="Any valid CSS rules">' + ShaBuilder.escHtml(inlineStyleStr) + '</textarea>'
                + '</div>';

            /* interactive pseudo-states for links/buttons */
            var interactiveTags = ['a', 'button', 'input', 'textarea', 'select'];
            if (interactiveTags.indexOf(tag) !== -1) {
                styleHtml += '<div class="sha-props-group"><div class="sha-props-group-title">Interactive States</div>';
                styleHtml += '<div class="sha-pseudo-tabs" style="display:flex;gap:2px;margin-bottom:6px;">';
                var states = [
                    { key: 'hover', label: 'Hover' },
                    { key: 'focus', label: 'Focus' },
                    { key: 'active', label: 'Active' }
                ];
                for (var si = 0; si < states.length; si++) {
                    var st = states[si];
                    styleHtml += '<button class="sha-pseudo-tab' + (si === 0 ? ' active' : '') + '" data-state="' + st.key + '" style="flex:1;padding:4px 6px;font-size:10px;font-weight:600;border:none;background:#1e1e34;color:#7a7a9a;cursor:pointer;border-radius:4px;transition:all 0.12s;">' + st.label + '</button>';
                }
                styleHtml += '</div>';
                for (var si2 = 0; si2 < states.length; si2++) {
                    var st2 = states[si2];
                    styleHtml += '<div class="sha-pseudo-fields" data-state="' + st2.key + '"' + (si2 > 0 ? ' style="display:none;"' : '') + '>';
                    var pseudoFields = [
                        { prop: 'color', type: 'color', label: 'Color' },
                        { prop: 'background-color', type: 'color', label: 'Background' },
                        { prop: 'opacity', type: 'range', min: 0, max: 1, step: 0.05, label: 'Opacity' },
                    ];
                    for (var pfi = 0; pfi < pseudoFields.length; pfi++) {
                        var pf = pseudoFields[pfi];
                        if (pf.type === 'color') {
                            styleHtml += '<label class="sha-props-field">'
                                + '<span>' + pf.label + '</span>'
                                + '<div class="sha-field-row" style="flex:1;display:flex;gap:4px;">'
                                + '<input type="text" class="sha-pseudo-input" data-state="' + st2.key + '" data-css="' + pf.prop + '" data-original="" value="" placeholder="' + pf.label + '" style="flex:1;min-width:0;" />'
                                + '<input type="color" class="sha-pseudo-color" value="#000000" style="width:28px;height:28px;padding:0;border:1px solid #2d2d44;border-radius:4px;cursor:pointer;" />'
                                + '</div>'
                                + '</label>';
                        } else if (pf.type === 'range') {
                            styleHtml += '<label class="sha-props-field">'
                                + '<span>' + pf.label + '</span>'
                                + '<div class="sha-field-row" style="flex:1;display:flex;gap:4px;align-items:center;">'
                                + '<input type="range" class="sha-pseudo-input" data-state="' + st2.key + '" data-css="' + pf.prop + '" data-original="" min="' + pf.min + '" max="' + pf.max + '" step="' + pf.step + '" value="1" style="flex:1;" />'
                                + '<span class="sha-range-label">1</span>'
                                + '</div>'
                                + '</label>';
                        }
                    }
                    styleHtml += '</div>';
                }
                styleHtml += '</div>';
            }

            $('#sha-props-style').html(styleHtml);

            /* ---- effects tab ---- */
            var effectsHtml = '<div class="sha-props-group"><div class="sha-props-group-title">Transforms</div>';
            var compTransform = compStyle.getPropertyValue('transform') || '';
            var scaleMatch = compTransform.match(/scale\(([^)]+)\)/);
            var rotateMatch = compTransform.match(/rotate\(([^)]+)\)/);
            var currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
            var currentRotate = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
            effectsHtml += '<label class="sha-props-field"><span>Scale</span><input type="range" min="0.1" max="3" step="0.1" value="' + currentScale + '" id="sha-eff-scale" data-original="' + currentScale + '" /><span class="sha-eff-val" id="sha-eff-scale-val">' + currentScale + '</span></label>';
            effectsHtml += '<label class="sha-props-field"><span>Rotate (deg)</span><input type="range" min="-360" max="360" step="1" value="' + currentRotate + '" id="sha-eff-rotate" data-original="' + currentRotate + '" /><span class="sha-eff-val" id="sha-eff-rotate-val">' + currentRotate + '</span></label>';
            effectsHtml += '</div>';
            effectsHtml += '<div class="sha-props-group"><div class="sha-props-group-title">Filters</div>';
            var compFilter = compStyle.getPropertyValue('filter') || '';
            var blurMatch = compFilter.match(/blur\(([^)]+)\)/);
            var brightnessMatch = compFilter.match(/brightness\(([^)]+)\)/);
            var contrastMatch = compFilter.match(/contrast\(([^)]+)\)/);
            var currentBlur = blurMatch ? parseFloat(blurMatch[1]) : 0;
            var currentBrightness = brightnessMatch ? parseFloat(brightnessMatch[1]) : 1;
            var currentContrast = contrastMatch ? parseFloat(contrastMatch[1]) : 1;
            effectsHtml += '<label class="sha-props-field"><span>Blur (px)</span><input type="range" min="0" max="20" step="0.5" value="' + currentBlur + '" id="sha-eff-blur" data-original="' + currentBlur + '" /><span class="sha-eff-val" id="sha-eff-blur-val">' + currentBlur + '</span></label>';
            effectsHtml += '<label class="sha-props-field"><span>Brightness</span><input type="range" min="0" max="3" step="0.1" value="' + currentBrightness + '" id="sha-eff-brightness" data-original="' + currentBrightness + '" /><span class="sha-eff-val" id="sha-eff-brightness-val">' + currentBrightness + '</span></label>';
            effectsHtml += '<label class="sha-props-field"><span>Contrast</span><input type="range" min="0" max="3" step="0.1" value="' + currentContrast + '" id="sha-eff-contrast" data-original="' + currentContrast + '" /><span class="sha-eff-val" id="sha-eff-contrast-val">' + currentContrast + '</span></label>';
            effectsHtml += '</div>';
            effectsHtml += '<div class="sha-props-group"><div class="sha-props-group-title">Box Shadow</div>';
            effectsHtml += '<label class="sha-props-field"><span>H-offset</span><input type="text" id="sha-eff-sh-h" value="0" data-original="0" placeholder="0" /></label>';
            effectsHtml += '<label class="sha-props-field"><span>V-offset</span><input type="text" id="sha-eff-sh-v" value="0" data-original="0" placeholder="0" /></label>';
            effectsHtml += '<label class="sha-props-field"><span>Blur</span><input type="text" id="sha-eff-sh-blur" value="10" data-original="10" placeholder="10" /></label>';
            effectsHtml += '<label class="sha-props-field"><span>Color</span><input type="text" id="sha-eff-sh-color" value="rgba(0,0,0,0.3)" data-original="rgba(0,0,0,0.3)" placeholder="rgba(0,0,0,0.3)" /></label>';
            effectsHtml += '</div>';
            $('#sha-props-effects').html(effectsHtml);

            this._updatePropsPanelTitle($el, tag, props);
        },

        _updatePropsPanelTitle: function ($el, tag, props) {
            var labelEl = $('#sha-props-panel .sha-props-title');
            var idStr = $el.attr('id') ? '#' + $el.attr('id') : '';
            labelEl.text(props.label + ' <' + tag + '>' + idStr);
        },

        applyPropsToElement: function ($el) {
            if (!$el) return;
            /* attributes tab */
            $('#sha-props-attrs input[data-attr]').each(function () {
                var attr = $(this).data('attr');
                var val = $(this).val();
                if (val) $el.attr(attr, val);
                else $el.removeAttr(attr);
            });
            /* text content */
            var $textContent = $('#sha-props-attrs textarea[data-text="content"]');
            if ($textContent.length) {
                var textVal = $textContent.val();
                $el.contents().filter(function () { return this.nodeType === 3; }).remove();
                if (textVal) {
                    $el.append(document.createTextNode(textVal));
                }
            }
            /* style tab: individual fields — only save changed values */
            var rules = [];
            $('#sha-props-style input[data-css]:not(.sha-pseudo-input)').each(function () {
                var prop = $(this).data('css');
                var val = $(this).val();
                var orig = $(this).attr('data-original') || '';
                if (!val) return;
                if (val === orig) return;
                rules.push(prop + ':' + val);
            });
            $('#sha-props-style select[data-css]:not(.sha-pseudo-input)').each(function () {
                var prop = $(this).data('css');
                var val = $(this).val();
                var orig = $(this).attr('data-original') || '';
                if (!val) return;
                if (val === orig) return;
                rules.push(prop + ':' + val);
            });
            /* custom css textarea — skip rules whose property is already set by a field */
            var rulesProps = {};
            for (var ri = 0; ri < rules.length; ri++) {
                rulesProps[rules[ri].split(':')[0]] = true;
            }
            var customCss = $('#sha-props-custom-css').val();
            if (customCss) {
                $.each(customCss.split(';'), function (i, r) {
                    r = $.trim(r);
                    if (!r) return;
                    var rProp = r.split(':')[0];
                    if (!rulesProps[rProp]) rules.push(r);
                });
            }
            /* effects tab — compare against data-original */
            var scale = $('#sha-eff-scale').val();
            var scaleOrig = $('#sha-eff-scale').attr('data-original');
            var rotate = $('#sha-eff-rotate').val();
            var rotateOrig = $('#sha-eff-rotate').attr('data-original');
            var transforms = [];
            if (scale !== scaleOrig) transforms.push('scale(' + scale + ')');
            if (rotate !== rotateOrig) transforms.push('rotate(' + rotate + 'deg)');
            if (transforms.length) {
                rules.push('transform:' + transforms.join(' '));
            }
            var blur = $('#sha-eff-blur').val();
            var blurOrig = $('#sha-eff-blur').attr('data-original');
            var brightness = $('#sha-eff-brightness').val();
            var brightnessOrig = $('#sha-eff-brightness').attr('data-original');
            var contrast = $('#sha-eff-contrast').val();
            var contrastOrig = $('#sha-eff-contrast').attr('data-original');
            var filters = [];
            if (blur !== blurOrig) filters.push('blur(' + blur + 'px)');
            if (brightness !== brightnessOrig) filters.push('brightness(' + brightness + ')');
            if (contrast !== contrastOrig) filters.push('contrast(' + contrast + ')');
            if (filters.length) {
                rules.push('filter:' + filters.join(' '));
            }
            var shH = $('#sha-eff-sh-h').val();
            var shHOrig = $('#sha-eff-sh-h').attr('data-original');
            var shV = $('#sha-eff-sh-v').val();
            var shVOrig = $('#sha-eff-sh-v').attr('data-original');
            var shBlur = $('#sha-eff-sh-blur').val();
            var shBlurOrig = $('#sha-eff-sh-blur').attr('data-original');
            var shColor = $('#sha-eff-sh-color').val();
            var shColorOrig = $('#sha-eff-sh-color').attr('data-original');
            if (shH !== shHOrig || shV !== shVOrig || shBlur !== shBlurOrig) {
                rules.push('box-shadow:' + (shH || '0') + ' ' + (shV || '0') + ' ' + (shBlur || '10') + ' ' + (shColor || 'rgba(0,0,0,0.3)'));
            }

            $el.attr('style', rules.join(';'));

            /* update data-original on all inputs so next save compares against current values */
            $('#sha-props-style input[data-css]:not(.sha-pseudo-input), #sha-props-style select[data-css]:not(.sha-pseudo-input)').each(function () {
                $(this).attr('data-original', $(this).val());
            });
            $('#sha-props-style .sha-pseudo-input').each(function () {
                $(this).attr('data-original', $(this).val());
            });
            $('#sha-eff-scale, #sha-eff-rotate, #sha-eff-blur, #sha-eff-brightness, #sha-eff-contrast').each(function () {
                $(this).attr('data-original', $(this).val());
            });
            var newStyleStr = rules.join(';');
            $('#sha-props-custom-css').val(newStyleStr);

            /* store in element overrides */
            if (this._inspectSectionId) {
                var sel = this.buildElementSelector($el);
                if (!this._elementOverrides[this._inspectSectionId]) {
                    this._elementOverrides[this._inspectSectionId] = {};
                }
                if (rules.length) {
                    this._elementOverrides[this._inspectSectionId][sel] = {};
                    for (var ri = 0; ri < rules.length; ri++) {
                        var parts = rules[ri].split(':');
                        if (parts.length >= 2) {
                            var prop = parts.shift();
                            this._elementOverrides[this._inspectSectionId][sel][prop] = parts.join(':');
                        }
                    }
                } else {
                    delete this._elementOverrides[this._inspectSectionId][sel];
                }

                /* pseudo-state overrides */
                var interactiveTags = ['a', 'button', 'input', 'textarea', 'select'];
                var tag = $el.prop('tagName').toLowerCase();
                if (interactiveTags.indexOf(tag) !== -1) {
                    var states = ['hover', 'focus', 'active'];
                    for (var si = 0; si < states.length; si++) {
                        var st = states[si];
                        var pseudoRules = [];
                        $('#sha-props-style .sha-pseudo-input[data-state="' + st + '"]').each(function () {
                            var prop = $(this).data('css');
                            var val = $(this).val();
                            var orig = $(this).attr('data-original') || '';
                            if (!val) return;
                            if (val === orig) return;
                            pseudoRules.push(prop + ':' + val);
                        });
                        if (pseudoRules.length) {
                            var pseudoSel = sel + ':' + st;
                            this._elementOverrides[this._inspectSectionId][pseudoSel] = {};
                            for (var pri = 0; pri < pseudoRules.length; pri++) {
                                var pParts = pseudoRules[pri].split(':');
                                if (pParts.length >= 2) {
                                    var pProp = pParts.shift();
                                    this._elementOverrides[this._inspectSectionId][pseudoSel][pProp] = pParts.join(':');
                                }
                            }
                        }
                    }
                }
            }
        },

        /* ---- inspect bar ---- */
        buildInspectBar: function (id) {
            var sec = this.findSection(id);
            var label = sec ? sec.label : 'Section';
            var html = '<div id="sha-inspect-bar" class="sha-inspect-bar">'
                + '<span class="sha-inspect-bar-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="8"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Inspector: ' + this.escHtml(label) + '</span>'
                + '<button data-action="saveInline" class="sha-tb-btn sha-tb-primary">Save &amp; Exit</button>'
                + '<button data-action="cancelInline" class="sha-tb-btn">Cancel</button>'
                + '</div>';
            $('body').append(html);
        },

        /* ===========================================
           SAVE
           =========================================== */
        saveAll: function (callback) {
            var self = this;
            if (this._inspectActive) {
                this.commitInlineEdit();
            }
            var payload = {
                action: 'sha_builder_frontend_save',
                nonce: this.nonce,
                post_id: this.postId,
                sections_json: JSON.stringify(this.sections),
                global_css: this.globalCss,
                global_js: this.globalJs,
                element_overrides: JSON.stringify(this._elementOverrides)
            };
            this.showToast('Saving...', 'info');
            $.post(this.ajaxUrl, payload, function (response) {
                if (response.success) {
                    self.showToast('Saved!', 'success');
                    if (callback) setTimeout(callback, 400);
                } else {
                    var msg = response.data && response.data.message ? response.data.message : 'Save failed.';
                    self.showToast(msg, 'error');
                }
            }).fail(function () {
                self.showToast('Network error.', 'error');
            });
        },

        /* ===========================================
           TOAST
           =========================================== */
        showToast: function (message, type) {
            var $container = $('#sha-toast-container');
            if (!$container.length) {
                $container = $('<div id="sha-toast-container"></div>');
                $('body').append($container);
            }
            var $toast = $('<div class="sha-toast-item ' + (type || 'info') + '">' + this.escHtml(message) + '</div>');
            $container.append($toast);
            setTimeout(function () { $toast.addClass('active'); }, 10);
            setTimeout(function () {
                $toast.removeClass('active');
                setTimeout(function () { $toast.remove(); }, 300);
            }, 3000);
        },

        /* ===========================================
           KEYBOARD SHORTCUTS
           =========================================== */
        handleKeyboard: function (e) {
            if ($('#sha-code-modal').hasClass('active')) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.saveCodeFromModal();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                if (this.currentSectionId) this.openCodeModal(this.currentSectionId);
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                if (this.currentSectionId) this.duplicateSection(this.currentSectionId);
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                var tag = (document.activeElement || {}).tagName || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                if (this.currentSectionId && this.sections.length > 1) {
                    this.removeSection(this.currentSectionId);
                }
                return;
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                var tag = (document.activeElement || {}).tagName || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                if (!this.currentSectionId) return;
                var idx = this.findSectionIndex(this.currentSectionId);
                if (e.key === 'ArrowUp' && idx > 0) {
                    e.preventDefault();
                    this.moveSection(idx, idx - 1);
                } else if (e.key === 'ArrowDown' && idx < this.sections.length - 1) {
                    e.preventDefault();
                    this.moveSection(idx, idx + 1);
                }
                return;
            }
        }
    };

    /* ===========================================
       EVENT BINDINGS
       =========================================== */

    // Context menu on right-click
    $(document).on('contextmenu', function (e) {
        if ($(e.target).closest('.sha-floating-toolbar, #sha-context-menu, #sha-code-modal').length) return;
        var id = ShaBuilder.getSectionIdFromElement($(e.target));
        if (!id) return;
        e.preventDefault();
        ShaBuilder.currentSectionId = id;
        ShaBuilder._contextTargetEl = $(e.target);
        ShaBuilder.showContextMenu(e.clientX, e.clientY);
    });

    // Visible edit button click -> open code editor
    $(document).on('click', '.sha-section-edit-btn', function (e) {
        e.stopPropagation();
        var $section = $(this).closest('[data-section-id], [id^="sha-section-"]');
        var id = ShaBuilder.getSectionIdFromElement($section);
        if (id) {
            ShaBuilder.currentSectionId = id;
            ShaBuilder.openCodeModal(id);
        }
    });

    // Menu item clicks
    $(document).on('click.sha-menu', '#sha-context-menu .sha-menu-item', function (e) {
        e.stopPropagation();
        var action = $(this).data('action');
        ShaBuilder.hideContextMenu();
        setTimeout(function () { ShaBuilder.handleContextAction(action); }, 50);
    });

    // Hide menu on outside click
    $(document).on('click.sha-outside', function (e) {
        if ($(e.target).closest('#sha-context-menu').length) return;
        if ($(e.target).closest('.sha-floating-toolbar').length) return;
        ShaBuilder.hideContextMenu();
    });

    // Keyboard
    $(document).on('keydown.sha-builder', function (e) {
        if (e.key === 'Escape') {
            ShaBuilder.hideContextMenu();
            ShaBuilder.hideCodeModal();
            ShaBuilder.cancelInlineEdit();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (ShaBuilder._inspectActive) {
                e.preventDefault();
                ShaBuilder.saveInlineEdit();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            ShaBuilder.undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            ShaBuilder.redo();
        }
        ShaBuilder.handleKeyboard(e);
    });

    // Element inspection: hover overlay on mousemove
    $(document).on('mousemove.shaInspect', function (e) {
        if (!ShaBuilder._inspectActive) return;
        // Once an element is selected, overlay stays on it
        if (ShaBuilder._selectedEl) return;
        var $target = $(e.target);
        if (!$target.closest('[data-section-id], [id^="sha-section-"]').length) {
            if (ShaBuilder._hoveredEl) {
                ShaBuilder._hoveredEl = null;
                ShaBuilder.removeInspectOverlay();
            }
            return;
        }
        if ($target.closest('#sha-props-panel, #sha-inspect-bar, .sha-floating-toolbar, .sha-section-edit-btn').length) {
            if (ShaBuilder._hoveredEl) {
                ShaBuilder._hoveredEl = null;
                ShaBuilder.removeInspectOverlay();
            }
            return;
        }
        if (ShaBuilder._hoveredEl && ShaBuilder._hoveredEl[0] === $target[0]) return;
        ShaBuilder._hoveredEl = $target;
        ShaBuilder.showInspectOverlay($target);
    });

    // Element inspection: click to select (non-<a> elements — <a> handled by native capturing listener)
    $(document).on('click.shaInspect', function (e) {
        if (!ShaBuilder._inspectActive) return;
        var $t = $(e.target);
        if ($t.is('a') || $t.closest('a').length) return;
        ShaBuilder.selectElement($t);
    });

    // Inspect bar buttons
    $(document).on('click', '#sha-inspect-bar button', function () {
        var action = $(this).data('action');
        if (action === 'saveInline') {
            ShaBuilder.saveInlineEdit();
        } else if (action === 'cancelInline') {
            ShaBuilder.cancelInlineEdit();
        }
    });

    // Properties panel: Save Element
    $(document).on('click', '#sha-props-save', function () {
        if (ShaBuilder._selectedEl) {
            ShaBuilder.applyPropsToElement(ShaBuilder._selectedEl);
            ShaBuilder.showToast('Element properties applied.', 'success');
        }
    });

    // Properties panel: Cancel / Close
    $(document).on('click', '#sha-props-cancel, #sha-props-close', function () {
        ShaBuilder.cancelInlineEdit();
    });

    // Properties panel: tab switching
    $(document).on('click', '.sha-props-tab', function () {
        var tab = $(this).data('ptab');
        $('.sha-props-tab').removeClass('active');
        $(this).addClass('active');
        $('.sha-props-content').removeClass('active');
        $('#sha-props-' + tab).addClass('active');
    });

    // Color picker sync: update text input when color changes
    $(document).on('input', '.sha-css-color-picker', function () {
        var val = $(this).val();
        $(this).closest('.sha-field-row').find('input[type="text"]').val(val);
    });

    // Color picker sync: update color picker when text changes (if valid color)
    $(document).on('input', '.sha-props-field input[data-css]', function () {
        var $textInput = $(this);
        if ($textInput.attr('type') !== 'text') return;
        var val = $textInput.val();
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val)) {
            $textInput.closest('.sha-field-row').find('.sha-css-color-picker').val(val);
        }
    });

    // Range slider live value display
    $(document).on('input', '#sha-props-style input[type="range"][data-css]', function () {
        var val = $(this).val();
        $(this).closest('.sha-field-row').find('.sha-range-label').text(val);
    });

    // Pseudo-state tab switching
    $(document).on('click', '.sha-pseudo-tab', function () {
        var state = $(this).data('state');
        $(this).closest('.sha-props-group').find('.sha-pseudo-tab').removeClass('active');
        $(this).addClass('active');
        $(this).closest('.sha-props-group').find('.sha-pseudo-fields').hide();
        $(this).closest('.sha-props-group').find('.sha-pseudo-fields[data-state="' + state + '"]').show();
    });

    // Pseudo-state color picker sync
    $(document).on('input', '.sha-pseudo-color', function () {
        var val = $(this).val();
        $(this).closest('.sha-field-row').find('.sha-pseudo-input').val(val);
    });

    // Properties panel: draggable
    $(document).on('mousedown', '#sha-props-panel .sha-props-header', function (e) {
        if ($(e.target).closest('.sha-props-close').length) return;
        var $panel = $('#sha-props-panel');
        var panelPos = $panel.offset();
        $panel.data('dragOffsetX', e.clientX - panelPos.left);
        $panel.data('dragOffsetY', e.clientY - panelPos.top);
        $panel.data('dragging', true);
        $panel.css('cursor', 'grabbing');
        e.preventDefault();
    });

    $(document).on('mousemove', function (e) {
        var $panel = $('#sha-props-panel');
        if (!$panel.length || !$panel.data('dragging')) return;
        var x = e.clientX - $panel.data('dragOffsetX');
        var y = e.clientY - $panel.data('dragOffsetY');
        x = Math.max(0, Math.min(x, window.innerWidth - $panel.outerWidth()));
        y = Math.max(0, Math.min(y, window.innerHeight - $panel.outerHeight()));
        $panel.css({ left: x, top: y, right: 'auto' });
    });

    $(document).on('mouseup', function () {
        var $panel = $('#sha-props-panel');
        if ($panel.length && $panel.data('dragging')) {
            $panel.data('dragging', false);
            $panel.css('cursor', '');
        }
    });

    // Floating toolbar
    $(document).on('click', '#sha-floating-toolbar button', function () {
        var action = $(this).data('action');
        switch (action) {
            case 'addAfter':
                ShaBuilder.addSection(ShaBuilder.sections.length);
                break;
            case 'saveAll':
                ShaBuilder.saveAll(function () { location.reload(); });
                break;
            case 'exitBuilder':
                var url = new URL(window.location.href);
                url.searchParams.delete('sha_builder');
                window.location.href = url.toString();
                break;
        }
    });

    // Code modal
    $(document).on('click', '#sha-modal-close-btn, #sha-code-cancel', function () {
        ShaBuilder.hideCodeModal();
    });
    $(document).on('click', '#sha-code-save', function () {
        ShaBuilder.saveCodeFromModal();
    });
    $(document).on('click', '#sha-code-tabs .sha-code-tab', function () {
        var tab = $(this).data('tab');
        $('#sha-code-tabs .sha-code-tab').removeClass('active');
        $(this).addClass('active');
        $('.sha-code-panel').removeClass('active');
        $('#sha-code-panel-' + tab).addClass('active');
    });

    $(document).ready(function () {
        ShaBuilder.init();
    });

})(jQuery);
