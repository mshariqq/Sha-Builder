/* global shaBuilder, jQuery */
(function ($) {
    'use strict';

    var ShaBuilder = {
        state: {
            postId: 0,
            activeTab: 'code',
            selectedElement: null,
            isDirty: false,
            currentSelector: null,
            overrides: {}, // { selector: { property: value } }
        },

        init: function () {
            this.state.postId = shaBuilder.postId || 0;
            this.cacheDOM();
            // Strip old-style html > body prefixes from saved CSS
            var cssVal = this.$cssInput.val();
            var cleaned = cssVal.replace(/^html(?::[^\s>]*)?\s*>\s*body(?::[^\s>]*)?\s*>\s*/gim, '');
            if (cleaned !== cssVal) {
                this.$cssInput.val(cleaned);
                console.log('[SHA BUILDER] Cleaned old-style html>body selectors from CSS');
            }
            // Parse saved overrides from CSS textarea
            this.parseOverridesFromCSS();



            console.log('[SHA BUILDER] Init post_id=' + this.state.postId + ' html_len=' + (this.$htmlInput.val() || '').length + ' css_len=' + (this.$cssInput.val() || '').length + ' js_len=' + (this.$jsInput.val() || '').length + ' overrides=' + Object.keys(this.state.overrides).length);
            this.bindEvents();
            this.renderPreview();
        },

        cacheDOM: function () {
            this.$wrap         = $('.sha-builder-wrap');
            this.$htmlInput    = $('#sha-html-code');
            this.$cssInput     = $('#sha-css-code');
            this.$jsInput      = $('#sha-js-code');
            this.$previewFrame = $('#sha-preview-frame');
            this.$saveBtn      = $('#sha-save-btn');
            this.$renderBtn    = $('#sha-render-btn');
            this.$closeBtn     = $('.sha-btn-close');
            this.$tabs         = $('.sha-tab-btn');
            this.$panels       = $('.sha-panel-content');
            this.$propPanel    = $('#properties-panel');
            this.$attrPanel    = $('#attributes-panel');
            this.$leftPanel    = $('.sha-left-panel');
            this.$resizeHandle = $('.sha-resize-handle');
            this.$loadingOverlay = $('.sha-loading-overlay');
            this.$modalOverlay = $('#sha-confirm-modal');
            this.$modalMessage = $('#sha-modal-message');
            this.$modalConfirm = $('#sha-modal-confirm');
            this.$modalCancel  = $('#sha-modal-cancel');
        },

        bindEvents: function () {
            this.$saveBtn.on('click', $.proxy(this.save, this));
            this.$renderBtn.on('click', $.proxy(this.renderPreview, this));
            this.$tabs.on('click', $.proxy(this.switchTab, this));
            this.$closeBtn.on('click', $.proxy(this.handleClose, this));

            window.addEventListener('message', $.proxy(this.handleIframeMessage, this));

            $(document).on('keydown', $.proxy(function (e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.save();
                }
            }, this));

            var self = this;
            this.$htmlInput.add(this.$cssInput).add(this.$jsInput).on('input', function () {
                self.markDirty();
            });

            // Device preview buttons
            this.$wrap.on('click', '.sha-device-btn', function () {
                var $btn = $(this);
                var device = $btn.data('device');
                $btn.closest('.sha-device-switcher').find('.sha-device-btn').removeClass('active');
                $btn.addClass('active');
                self.setPreviewDevice(device);
            });

            // Toggle left panel collapse
            this.$wrap.on('click', '.sha-toggle-panel', function () {
                var $panel = $('.sha-left-panel');
                $panel.toggleClass('collapsed');
                var isCollapsed = $panel.hasClass('collapsed');
                // Toggle between hamburger and close icon
                var $btn = $(this);
                if (isCollapsed) {
                    $btn.find('svg').html('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
                    $btn.addClass('active');
                } else {
                    $btn.find('svg').html('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>');
                    $btn.removeClass('active');
                }
                // Trigger window resize for iframe to adjust
                $(window).trigger('resize');
            });

            // Panel resize
            this.$resizeHandle.on('mousedown', function (e) {
                e.preventDefault();
                var startX = e.clientX;
                var startWidth = self.$leftPanel.outerWidth();
                self.$resizeHandle.addClass('active');
                $(document).on('mousemove.sha-resize', function (e2) {
                    var dx = e2.clientX - startX;
                    var newW = startWidth + dx;
                    newW = Math.max(260, Math.min(newW, window.innerWidth * 0.55));
                    self.$leftPanel.css('width', newW);
                });
                $(document).on('mouseup.sha-resize', function () {
                    self.$resizeHandle.removeClass('active');
                    $(document).off('.sha-resize');
                });
            });

            // Modal confirm/cancel
            this.$modalConfirm.add(this.$modalCancel).on('click', function () {
                self.hideModal();
                var cb = self._modalCallback;
                self._modalCallback = null;
                if ($(this).is(self.$modalConfirm) && cb) cb(true);
                else if (cb) cb(false);
            });

            // Close modal on overlay click
            this.$modalOverlay.on('click', function (e) {
                if (e.target === this) {
                    self.hideModal();
                    var cb = self._modalCallback;
                    self._modalCallback = null;
                    if (cb) cb(false);
                }
            });

            // Close modal on Escape
            $(document).on('keydown.sha-modal', function (e) {
                if (e.key === 'Escape' && self.$modalOverlay.is(':visible')) {
                    self.hideModal();
                    var cb = self._modalCallback;
                    self._modalCallback = null;
                    if (cb) cb(false);
                }
            });
        },

        switchTab: function (e) {
            var tab = $(e.currentTarget).data('tab');
            this.state.activeTab = tab;
            this.$tabs.removeClass('active');
            $(e.currentTarget).addClass('active');
            this.$panels.removeClass('active');
            $('#' + tab + '-panel').addClass('active');
        },

        switchToTab: function (tabName) {
            this.$tabs.removeClass('active');
            this.$tabs.filter('[data-tab="' + tabName + '"]').addClass('active');
            this.$panels.removeClass('active');
            $('#' + tabName + '-panel').addClass('active');
        },

        markDirty: function () {
            if (!this.state.isDirty) {
                this.state.isDirty = true;
                this.$saveBtn.append('<span class="sha-dirty-dot"></span>');
            }
        },

        clearDirty: function () {
            this.state.isDirty = false;
            this.$saveBtn.find('.sha-dirty-dot').remove();
        },

        /* ===================================================
               BUILD & RENDER PREVIEW
               =================================================== */
        buildPreviewDocument: function () {
            var html = this.$htmlInput.val();
            var css  = this.$cssInput.val();
            var js   = this.$jsInput.val();

            // Strip existing override block from CSS textarea (state is the source of truth)
            var marker = '/* === SHA BUILDER OVERRIDES === */';
            var markerIdx = css.indexOf(marker);
            if (markerIdx !== -1) {
                css = css.substring(0, markerIdx).trim();
            }

            // Generate override CSS from state (single source of truth)
            var overrideCSS = '';
            for (var sel in this.state.overrides) {
                var props = this.state.overrides[sel];
                var rule = sel + ' { ';
                for (var p in props) {
                    rule += p + ': ' + props[p] + ' !important; ';
                }
                rule += '}';
                overrideCSS += '\n' + rule;
            }
            if (overrideCSS) {
                css += '\n\n' + marker + overrideCSS;
            }

            var inspectorScript = [
                '(function(){',
                'var overlay=document.getElementById("sha-inspector-overlay");',
                'var selOverlay=document.getElementById("sha-selected-overlay");',
                'var selected=null;',
                'var lastHovered=null;',
                'function posOverlay(o,el){var r=el.getBoundingClientRect();o.style.display="block";o.style.top=(r.top+window.scrollY)+"px";o.style.left=(r.left+window.scrollX)+"px";o.style.width=r.width+"px";o.style.height=r.height+"px"}',
                'function getInfo(el){',
                'var info={tagName:(el.tagName||"").toLowerCase(),id:el.id||"",className:(el.className&&typeof el.className==="string")?el.className:"",attributes:{},textContent:(el.textContent||"").trim().substring(0,1000),explicitCSS:{},computedRef:{}};',
                'for(var i=0;i<(el.attributes||[]).length;i++){var a=el.attributes[i];if(a.name!=="style"){info.attributes[a.name]=a.value}}',
                'var comp=window.getComputedStyle(el);var parentComp=el.parentElement?window.getComputedStyle(el.parentElement):null;',
                'var nonInh=["display","width","height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","border-top-width","border-right-width","border-bottom-width","border-left-width","border-top-color","border-right-color","border-bottom-color","border-left-color","border-top-style","border-right-style","border-bottom-style","border-left-style","position","top","left","right","bottom","float","overflow","z-index","opacity","transform","box-shadow","border-radius","background-color","background","outline","cursor","clip-path","filter","backdrop-filter","flex-direction","flex-wrap","justify-content","align-items","gap","min-width","min-height","max-width","max-height","transition","pointer-events","user-select"];',
                'var inh=["color","font-size","font-weight","font-family","text-align","line-height","letter-spacing","word-spacing","white-space","text-decoration","visibility","font-style","text-transform"];',
                'var all=nonInh.concat(inh);',
                'for(var p=0;p<all.length;p++){var prop=all[p];var v=comp.getPropertyValue(prop);if(v&&v!=="none"&&v!=="normal"&&v!=="0px"&&v!=="auto"&&v!=="visible"&&v!=="static"){info.computedRef[prop]=v;var isExplicit=(nonInh.indexOf(prop)!==-1);if(!isExplicit&&(!parentComp||v!==parentComp.getPropertyValue(prop))){isExplicit=true}if(isExplicit){info.explicitCSS[prop]=v}}}',
                'for(var s=0;s<el.style.length;s++){var ip=el.style[s];info.explicitCSS[ip]=el.style.getPropertyValue(ip)}',
                'return info',
                '}',
                'document.addEventListener("mouseover",function(e){',
                'var el=e.target;if(!el||el===overlay||el===selOverlay||el===document.body||el===document.documentElement){overlay.style.display="none";return}',
                'lastHovered=el;if(el!==selected){posOverlay(overlay,el)}else{overlay.style.display="none"}',
                '},true);',
                'document.addEventListener("mouseout",function(e){',
                'var el=e.target;if(!el||el===overlay||el===selOverlay||el===document.body||el===document.documentElement)return;',
                'if(el!==selected){overlay.style.display="none"}',
                '},true);',
                'document.addEventListener("click",function(e){',
                'var el=e.target;if(!el||el===overlay||el===selOverlay||el===document.body||el===document.documentElement)return;',
                'e.preventDefault();e.stopPropagation();selected=el;',
                'posOverlay(selOverlay,el);overlay.style.display="none";',
                'var info=getInfo(el);',
                'window.parent.postMessage({type:"element-selected",data:JSON.stringify(info),selector:getSelector(el)},"*")',
                '},true);',
                'function getSelector(el){if(el.id)return"#"+CSS.escape(el.id);',
                'var path=[];while(el&&el.nodeType===1&&el.tagName.toLowerCase()!=="html"&&el.tagName.toLowerCase()!=="body"){var sel=el.tagName.toLowerCase();if(el.id){path.unshift("#"+CSS.escape(el.id));break}',
                'if(el.className&&typeof el.className==="string"){var cls=el.className.trim().split(/\\s+/).filter(function(c){return c.length>0&&!c.startsWith("sha-")}).slice(0,2);if(cls.length)sel+="."+cls.map(function(c){return CSS.escape(c)}).join(".")}',
                'var p=el.parentNode;if(p&&p.nodeType===1){var ci=Array.prototype.indexOf.call(p.children,el);sel+=":nth-child("+(ci+1)+")"}',
                'path.unshift(sel);el=el.parentNode}',
                'return path.join(" > ")',
                '}',
                'window.addEventListener("message",function(e){',
                'if(!e.data||!e.data.type)return;',
                'if(e.data.type==="refresh-selected"&&selected){',
                'var info=getInfo(selected);',
                'posOverlay(selOverlay,selected);',
                'window.parent.postMessage({type:"element-selected",data:JSON.stringify(info),selector:getSelector(selected)},"*")',
                '}',
                'if(!selected)return;',
                'switch(e.data.type){',
                'case"update-text":selected.textContent=e.data.value;posOverlay(selOverlay,selected);break;',
                'case"update-attr":if(e.data.value===""||e.data.value==null)selected.removeAttribute(e.data.key);else selected.setAttribute(e.data.key,e.data.value);posOverlay(selOverlay,selected);break;',
                'case"update-style":selected.style[e.data.prop]=e.data.value;break;',
                'case"update-inner-html":selected.innerHTML=e.data.value;posOverlay(selOverlay,selected);break;',
                '}',
                '});',
                '})()'
            ].join('');

            var inspectorCSS = [
                '#sha-inspector-overlay{position:absolute;pointer-events:none;border:2px dashed rgba(240,131,58,0.5);z-index:999998;display:none;transition:all 0.08s ease;border-radius:2px}',
                '#sha-selected-overlay{position:absolute;pointer-events:none;border:2px solid #f0833a;z-index:999999;display:none;background:rgba(240,131,58,0.04);box-shadow:0 0 0 1.5px rgba(240,131,58,0.3),inset 0 0 0 1px rgba(240,131,58,0.08);border-radius:2px;transition:all 0.12s ease}',
                '*:hover{cursor:crosshair}',
                'body{padding-bottom:240px!important;min-height:100vh;}'
            ].join('');

            return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
                + '<style>' + inspectorCSS + css + '</style>'
                + '</head><body>'
                + html
                + '<div id="sha-inspector-overlay"></div>'
                + '<div id="sha-selected-overlay"></div>'
                + '<script>' + inspectorScript + '<\/script>'
                + (js ? '<script>' + js + '<\/script>' : '')
                + '</body></html>';
        },

        renderPreview: function () {
            this.startLoading();
            var doc = this.buildPreviewDocument();
            this.$previewFrame.attr('srcdoc', doc);

            var self = this;
            this.$previewFrame.off('load').on('load', function () {
                setTimeout(function () {
                    try {
                        var iframeDoc = self.$previewFrame[0].contentDocument || self.$previewFrame[0].contentWindow.document;
                        if (iframeDoc) {
                            var height = iframeDoc.documentElement.scrollHeight;
                            self.$previewFrame.height(height);
                        }
                    } catch (e) {}
                    self.stopLoading();
                    self.injectPseudoStyles();
                }, 100);
            });
        },

        setPreviewDevice: function (device) {
            var $container = this.$previewFrame.parent();
            $container.removeClass('sha-responsive-desktop sha-responsive-tablet sha-responsive-mobile');
            if (device === 'desktop') {
                $container.addClass('sha-responsive-desktop');
                $container.css({ 'max-width': '', 'margin': '' });
            } else if (device === 'tablet') {
                $container.addClass('sha-responsive-tablet');
            } else if (device === 'mobile') {
                $container.addClass('sha-responsive-mobile');
            }
        },

        /* ===================================================
               IFRAME MESSAGE HANDLER
               =================================================== */
        handleIframeMessage: function (e) {
            if (e.origin !== window.location.origin) return;
            if (!e.data || e.data.type !== 'element-selected') return;

            try {
                var data = JSON.parse(e.data.data);
                this.state.selectedElement = data;
                this.state.currentSelector = e.data.selector || null;
                this.displayElementProperties(data);
            } catch (err) {
                console.error('Sha Builder: Failed to parse element data', err);
            }
        },

        /* ===================================================
               DISPLAY ELEMENT PROPERTIES
               =================================================== */
        displayElementProperties: function (data) {
            this.switchToTab('properties');

            var self = this;
            var propHtml = '';

            // Element info header
            propHtml += '<div class="sha-element-info">';
            propHtml += '<h3><span class="sha-tag">&lt;' + this.escHtml(data.tagName) + '&gt;</span>';
            if (data.id) propHtml += ' <span style="color:#e44d26;">#' + this.escHtml(data.id) + '</span>';
            if (data.className) propHtml += ' <span style="color:#264de4;font-size:11px;">.' + this.escHtml(data.className.split(' ').join('.')).substring(0, 60) + '</span>';
            propHtml += '</h3></div>';

            // Text content
            propHtml += '<div class="sha-field-group">';
            propHtml += '<label>Text Content</label>';
            propHtml += '<input type="text" class="sha-text-input" value="' + this.escAttr(data.textContent) + '" />';
            propHtml += '</div>';

            var computedRef = data.computedRef || {};
            var explicit = data.explicitCSS || {};
            var fixedProps = [
                // Text / Typography
                { prop: 'color',             label: 'Color',               group: 'Text' },
                { prop: 'font-family',       label: 'Font Family',        group: 'Text' },
                { prop: 'font-size',         label: 'Font Size',          group: 'Text' },
                { prop: 'font-weight',       label: 'Font Weight',        group: 'Text' },
                { prop: 'font-style',        label: 'Font Style',         group: 'Text' },
                { prop: 'text-align',        label: 'Text Align',         group: 'Text' },
                { prop: 'text-decoration',   label: 'Text Decoration',    group: 'Text' },
                { prop: 'text-transform',    label: 'Text Transform',     group: 'Text' },
                { prop: 'line-height',       label: 'Line Height',        group: 'Text' },
                { prop: 'letter-spacing',    label: 'Letter Spacing',     group: 'Text' },
                { prop: 'word-spacing',      label: 'Word Spacing',       group: 'Text' },
                { prop: 'white-space',       label: 'White Space',        group: 'Text' },
                // Background
                { prop: 'background-color',  label: 'Background Color',  group: 'Background' },
                { prop: 'background-image',  label: 'Background Image',  group: 'Background' },
                { prop: 'background-size',   label: 'Background Size',   group: 'Background' },
                { prop: 'background-position', label: 'Bg Position',     group: 'Background' },
                // Margin
                { prop: 'margin-top',        label: 'Margin Top',         group: 'Margin' },
                { prop: 'margin-right',      label: 'Margin Right',       group: 'Margin' },
                { prop: 'margin-bottom',     label: 'Margin Bottom',      group: 'Margin' },
                { prop: 'margin-left',       label: 'Margin Left',        group: 'Margin' },
                // Padding
                { prop: 'padding-top',       label: 'Padding Top',        group: 'Padding' },
                { prop: 'padding-right',     label: 'Padding Right',      group: 'Padding' },
                { prop: 'padding-bottom',    label: 'Padding Bottom',     group: 'Padding' },
                { prop: 'padding-left',      label: 'Padding Left',       group: 'Padding' },
                // Border
                { prop: 'border-radius',     label: 'Border Radius',      group: 'Border' },
                { prop: 'border-width',      label: 'Border Width',       group: 'Border' },
                { prop: 'border-style',      label: 'Border Style',       group: 'Border' },
                { prop: 'border-color',      label: 'Border Color',       group: 'Border' },
                // Layout
                { prop: 'display',           label: 'Display',            group: 'Layout' },
                { prop: 'width',             label: 'Width',              group: 'Layout' },
                { prop: 'height',            label: 'Height',             group: 'Layout' },
                { prop: 'overflow',          label: 'Overflow',           group: 'Layout' },
                { prop: 'flex-direction',    label: 'Flex Direction',     group: 'Layout' },
                { prop: 'flex-wrap',         label: 'Flex Wrap',          group: 'Layout' },
                { prop: 'align-items',       label: 'Align Items',        group: 'Layout' },
                { prop: 'justify-content',   label: 'Justify Content',    group: 'Layout' },
                { prop: 'gap',               label: 'Gap',                group: 'Layout' },
                // Effects
                { prop: 'opacity',           label: 'Opacity',            group: 'Effects' },
                { prop: 'cursor',            label: 'Cursor',             group: 'Effects' },
                { prop: 'box-shadow',        label: 'Box Shadow',         group: 'Effects' },
                { prop: 'transform',         label: 'Transform',          group: 'Effects' },
                { prop: 'transition',        label: 'Transition',         group: 'Effects' },
            ];

            propHtml += '<h4>Element Styles</h4>';

            var sel = this.state.currentSelector;
            var overridesForSel = (sel && this.state.overrides[sel]) || {};

            var propConfig = {
                'color':             { type: 'color' },
                'background-color':  { type: 'color' },
                'border-color':      { type: 'color' },
                'font-size':         { type: 'number-unit', units: ['px', 'em', 'rem'], defaultUnit: 'px' },
                'font-weight':       { type: 'select', options: ['100','200','300','400','500','600','700','800','900','normal','bold','lighter','bolder'] },
                'text-align':        { type: 'select', options: ['left','center','right','justify'] },
                'line-height':       { type: 'number-unit', units: ['', 'px', 'em', '%'], defaultUnit: '' },
                'letter-spacing':    { type: 'number-unit', units: ['px', 'em'], defaultUnit: 'px' },
                'word-spacing':      { type: 'number-unit', units: ['px', 'em'], defaultUnit: 'px' },
                'text-transform':    { type: 'select', options: ['none','uppercase','lowercase','capitalize'] },
                'font-style':        { type: 'select', options: ['normal','italic','oblique'] },
                'text-decoration':   { type: 'select', options: ['none','underline','overline','line-through'] },
                'white-space':       { type: 'select', options: ['normal','nowrap','pre','pre-wrap','pre-line'] },
                'margin-top':        { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'margin-right':      { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'margin-bottom':     { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'margin-left':       { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'padding-top':       { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'padding-right':     { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'padding-bottom':    { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'padding-left':      { type: 'number-unit', units: ['px', 'em', 'rem', '%'], defaultUnit: 'px' },
                'border-radius':     { type: 'number-unit', units: ['px', '%'], defaultUnit: 'px' },
                'border-width':      { type: 'number-unit', units: ['px'], defaultUnit: 'px' },
                'border-style':      { type: 'select', options: ['none','solid','dashed','dotted','double','groove','ridge','inset','outset'] },
                'display':           { type: 'select', options: ['block','flex','inline','inline-block','grid','none','contents','flow-root'] },
                'overflow':          { type: 'select', options: ['visible','hidden','scroll','auto'] },
                'flex-direction':    { type: 'select', options: ['row','column','row-reverse','column-reverse'] },
                'flex-wrap':         { type: 'select', options: ['nowrap','wrap','wrap-reverse'] },
                'align-items':       { type: 'select', options: ['flex-start','flex-end','center','stretch','baseline'] },
                'justify-content':   { type: 'select', options: ['flex-start','flex-end','center','space-between','space-around','space-evenly'] },
                'gap':               { type: 'number-unit', units: ['px', 'em', 'rem'], defaultUnit: 'px' },
                'cursor':            { type: 'select', options: ['auto','default','pointer','grab','move','not-allowed','text','wait','crosshair','help'] },
                'opacity':           { type: 'range', min: 0, max: 1, step: 0.05 },
                'background-size':   { type: 'select', options: ['cover','contain','auto','100%'] },
            };

            // Build groups from fixedProps preserving order
            var groups = {};
            var groupOrder = [];
            for (var fi = 0; fi < fixedProps.length; fi++) {
                var fp = fixedProps[fi];
                if (!groups[fp.group]) {
                    groups[fp.group] = [];
                    groupOrder.push(fp.group);
                }
                groups[fp.group].push(fp);
            }

            // Render each group as an accordion
            for (var gi = 0; gi < groupOrder.length; gi++) {
                var gName = groupOrder[gi];
                var props = groups[gName];
                var groupId = 'sha-group-' + gName.toLowerCase().replace(/\s+/g, '-');

                propHtml += '<div class="sha-accordion-header collapsed" data-group="' + this.escAttr(gName) + '">';
                propHtml += '<span class="sha-accordion-label">' + this.escHtml(gName) + '</span>';
                propHtml += '<span class="sha-accordion-icon">+</span>';
                propHtml += '</div>';
                propHtml += '<div class="sha-accordion-body" id="' + groupId + '" style="display:none;">';

                for (var pi = 0; pi < props.length; pi++) {
                    fp = props[pi];
                    var val = (explicit[fp.prop] !== undefined) ? explicit[fp.prop] : '';
                    var cfg = propConfig[fp.prop] || {};
                    var hasOverride = overridesForSel[fp.prop] !== undefined;

                    propHtml += '<div class="sha-field-group">';
                    propHtml += '<label>' + this.escHtml(fp.label) + '</label>';

                    if (cfg.type === 'color') {
                        var hexColor = this.toHexColor(val);
                        propHtml += '<div class="sha-field-row">';
                        propHtml += '<input type="text" class="sha-css-input" data-prop="' + this.escAttr(fp.prop) + '" value="' + this.escAttr(val) + '" placeholder="' + this.escAttr(fp.label) + '" />';
                        propHtml += '<input type="color" class="sha-color-picker" value="' + (hexColor || '#000000') + '" data-prop="' + this.escAttr(fp.prop) + '" />';
                        if (hasOverride) propHtml += '<button class="sha-prop-reset" data-prop="' + this.escAttr(fp.prop) + '" title="Reset">&times;</button>';
                        propHtml += '</div>';
                    } else if (cfg.type === 'number-unit') {
                        var parsed = this.splitCSSValue(val, cfg.defaultUnit || 'px');
                        propHtml += '<div class="sha-field-row">';
                        propHtml += '<input type="text" class="sha-num-input" data-prop="' + this.escAttr(fp.prop) + '" value="' + this.escAttr(parsed.num) + '" placeholder="' + this.escAttr(fp.label) + '" />';
                        propHtml += '<select class="sha-unit-select" data-prop="' + this.escAttr(fp.prop) + '">';
                        for (var ui = 0; ui < cfg.units.length; ui++) {
                            var uVal = cfg.units[ui];
                            propHtml += '<option value="' + this.escAttr(uVal) + '"' + (parsed.unit === uVal ? ' selected' : '') + '>' + (uVal || '\u2014') + '</option>';
                        }
                        propHtml += '</select>';
                        if (hasOverride) propHtml += '<button class="sha-prop-reset" data-prop="' + this.escAttr(fp.prop) + '" title="Reset">&times;</button>';
                        propHtml += '</div>';
                    } else if (cfg.type === 'select') {
                        propHtml += '<div class="sha-field-row">';
                        propHtml += '<select class="sha-prop-select" data-prop="' + this.escAttr(fp.prop) + '">';
                        for (var oi = 0; oi < cfg.options.length; oi++) {
                            var opt = cfg.options[oi];
                            propHtml += '<option value="' + this.escAttr(opt) + '"' + (val === opt ? ' selected' : '') + '>' + this.escHtml(opt) + '</option>';
                        }
                        propHtml += '</select>';
                        if (hasOverride) propHtml += '<button class="sha-prop-reset" data-prop="' + this.escAttr(fp.prop) + '" title="Reset">&times;</button>';
                        propHtml += '</div>';
                    } else if (cfg.type === 'range') {
                        var rNum = parseFloat(val);
                        if (isNaN(rNum)) rNum = cfg.min || 0;
                        propHtml += '<div class="sha-field-row">';
                        propHtml += '<div class="sha-range-control" style="flex:1;">';
                        propHtml += '<input type="range" class="sha-range-input" data-prop="' + this.escAttr(fp.prop) + '" min="' + cfg.min + '" max="' + cfg.max + '" step="' + cfg.step + '" value="' + rNum + '" />';
                        propHtml += '<span class="sha-range-value">' + rNum + '</span>';
                        propHtml += '</div>';
                        if (hasOverride) propHtml += '<button class="sha-prop-reset" data-prop="' + this.escAttr(fp.prop) + '" title="Reset">&times;</button>';
                        propHtml += '</div>';
                    } else {
                        propHtml += '<div class="sha-field-row">';
                        propHtml += '<input type="text" class="sha-css-input" data-prop="' + this.escAttr(fp.prop) + '" value="' + this.escAttr(val) + '" placeholder="' + this.escAttr(fp.label) + '" />';
                        if (hasOverride) propHtml += '<button class="sha-prop-reset" data-prop="' + this.escAttr(fp.prop) + '" title="Reset">&times;</button>';
                        propHtml += '</div>';
                    }

                    propHtml += '</div>';
                }

                propHtml += '</div>';
            }

            // === INTERACTIVE STATES (a, button) ===
            var tagName = (data.tagName || '').toLowerCase();
            if (tagName === 'a' || tagName === 'button') {
                var baseSel = this.state.currentSelector || '';
                var pseudoStates = [
                    { pseudo: 'hover', label: 'Hover' },
                    { pseudo: 'focus', label: 'Focus' },
                    { pseudo: 'active', label: 'Active' },
                ];
                var pseudoProps = [
                    { prop: 'color', label: 'Color', type: 'color' },
                    { prop: 'background-color', label: 'Background', type: 'color' },
                    { prop: 'text-decoration', label: 'Decoration', type: 'select', options: ['none','underline','overline','line-through'] },
                    { prop: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
                ];
                var isPseudoActive = {};
                for (var psi = 0; psi < pseudoStates.length; psi++) {
                    var ps = pseudoStates[psi];
                    var fullSel = baseSel ? baseSel + ':' + ps.pseudo : '';
                    if (fullSel && this.state.overrides[fullSel]) {
                        isPseudoActive[ps.pseudo] = true;
                    }
                }

                propHtml += '<h4>Interactive States</h4>';
                propHtml += '<div class="sha-pseudo-section">';
                propHtml += '<div class="sha-pseudo-tabs">';
                for (var pti = 0; pti < pseudoStates.length; pti++) {
                    var pst = pseudoStates[pti];
                    var activeClass = (pst.pseudo === 'hover') ? ' active' : '';
                    propHtml += '<button class="sha-pseudo-tab' + activeClass + '" data-state="' + pst.pseudo + '">' + pst.label + '</button>';
                }
                propHtml += '</div>';

                for (var psi2 = 0; psi2 < pseudoStates.length; psi2++) {
                    var ps2 = pseudoStates[psi2];
                    var fullSel2 = baseSel ? baseSel + ':' + ps2.pseudo : '';
                    var pseudoOverrides = (fullSel2 && this.state.overrides[fullSel2]) || {};

                    propHtml += '<div class="sha-pseudo-fields" data-state="' + ps2.pseudo + '">';
                    for (var ppi = 0; ppi < pseudoProps.length; ppi++) {
                        var pp = pseudoProps[ppi];
                        var pVal = pseudoOverrides[pp.prop] !== undefined ? pseudoOverrides[pp.prop] : '';
                        var pHasOverride = pseudoOverrides[pp.prop] !== undefined;

                        propHtml += '<div class="sha-field-group" style="padding:6px 0;">';
                        propHtml += '<label style="text-transform:none;letter-spacing:0;font-size:11px;">' + ps2.label + ' ' + pp.label + '</label>';

                        if (pp.type === 'color') {
                            var pHex = this.toHexColor(pVal);
                            propHtml += '<div class="sha-field-row">';
                            propHtml += '<input type="text" class="sha-pseudo-input" data-state="' + ps2.pseudo + '" data-prop="' + pp.prop + '" value="' + this.escAttr(pVal) + '" placeholder="' + pp.label + '" />';
                            propHtml += '<input type="color" class="sha-pseudo-color" data-state="' + ps2.pseudo + '" data-prop="' + pp.prop + '" value="' + (pHex || '#000000') + '" />';
                            if (pHasOverride) propHtml += '<button class="sha-prop-reset" data-state="' + ps2.pseudo + '" data-prop="' + pp.prop + '" title="Reset">&times;</button>';
                            propHtml += '</div>';
                        } else if (pp.type === 'select') {
                            propHtml += '<div class="sha-field-row">';
                            propHtml += '<select class="sha-pseudo-input" data-state="' + ps2.pseudo + '" data-prop="' + pp.prop + '" style="flex:1;">';
                            for (var pOi = 0; pOi < pp.options.length; pOi++) {
                                var pOpt = pp.options[pOi];
                                propHtml += '<option value="' + this.escAttr(pOpt) + '"' + (pVal === pOpt ? ' selected' : '') + '>' + this.escHtml(pOpt) + '</option>';
                            }
                            propHtml += '</select>';
                            if (pHasOverride) propHtml += '<button class="sha-prop-reset" data-state="' + ps2.pseudo + '" data-prop="' + pp.prop + '" title="Reset">&times;</button>';
                            propHtml += '</div>';
                        } else if (pp.type === 'range') {
                            var pRNum = parseFloat(pVal);
                            if (isNaN(pRNum)) pRNum = 1;
                            propHtml += '<div class="sha-field-row">';
                            propHtml += '<div class="sha-range-control" style="flex:1;">';
                            propHtml += '<input type="range" class="sha-pseudo-input" data-state="' + ps2.pseudo + '" data-prop="' + pp.prop + '" min="' + pp.min + '" max="' + pp.max + '" step="' + pp.step + '" value="' + pRNum + '" />';
                            propHtml += '<span class="sha-range-value">' + pRNum + '</span>';
                            propHtml += '</div>';
                            if (pHasOverride) propHtml += '<button class="sha-prop-reset" data-state="' + ps2.pseudo + '" data-prop="' + pp.prop + '" title="Reset">&times;</button>';
                            propHtml += '</div>';
                        }
                        propHtml += '</div>';
                    }
                    propHtml += '</div>';
                }

                propHtml += '</div>';
            }

            propHtml += '<div class="sha-new-attr-row">';
            propHtml += '<button class="sha-btn sha-btn-add-prop">+ Add CSS Property</button>';
            propHtml += '</div>';

            // === INHERITED VALUES (collapsible) ===
            var explicitKeys = Object.keys(explicit);
            var computedKeys = Object.keys(computedRef);
            var inheritedKeys = [];
            for (var ci = 0; ci < computedKeys.length; ci++) {
                var cp = computedKeys[ci];
                if (explicitKeys.indexOf(cp) === -1) {
                    inheritedKeys.push(cp);
                }
            }

            if (inheritedKeys.length > 0) {
                propHtml += '<h4 class="sha-inherited-toggle" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none;">';
                propHtml += '<span>Inherited Values</span>';
                propHtml += '<span class="sha-toggle-icon" style="font-size:16px;font-weight:400;">+</span>';
                propHtml += '</h4>';
                propHtml += '<div class="sha-inherited-body" style="display:none;">';
                for (var ci2 = 0; ci2 < inheritedKeys.length; ci2++) {
                    var ip = inheritedKeys[ci2];
                    if (computedRef[ip]) {
                        propHtml += '<div class="sha-field-group" style="opacity:0.65;">';
                        propHtml += '<label>' + this.escHtml(ip) + ' <span style="color:#6c6c8a;font-weight:400;text-transform:none;">(inherited)</span></label>';
                        propHtml += '<input type="text" class="sha-css-input sha-computed" data-prop="' + this.escAttr(ip) + '" value="' + this.escAttr(computedRef[ip]) + '" readonly style="cursor:default;opacity:0.7;" />';
                        propHtml += '</div>';
                    }
                }
                propHtml += '</div>';
            }

            propHtml += '<div class="sha-new-attr-row">';
            propHtml += '<button class="sha-btn sha-btn-add-prop">+ Add CSS Property</button>';
            propHtml += '</div>';

            // --- ATTRIBUTES SECTION (inline in Properties panel) ---
            var allAttrs = this.mergeAttributes(data);
            var attrKeys = Object.keys(allAttrs);

            if (attrKeys.length > 0) {
                propHtml += '<h4>Attributes</h4>';
                for (var ai = 0; ai < attrKeys.length; ai++) {
                    var ak = attrKeys[ai];
                    propHtml += '<div class="sha-field-group">';
                    propHtml += '<label>' + this.escHtml(ak) + '</label>';
                    propHtml += '<div class="sha-attr-row">';
                    propHtml += '<input type="text" class="sha-attr-input sha-attr-inline" data-attr="' + this.escAttr(ak) + '" value="' + this.escAttr(allAttrs[ak]) + '" />';
                    propHtml += '<button class="sha-attr-del" data-attr="' + this.escAttr(ak) + '" title="Remove attribute">&times;</button>';
                    propHtml += '</div></div>';
                }
            }

            // Add attribute button
            propHtml += '<div class="sha-new-attr-row">';
            propHtml += '<button class="sha-btn sha-btn-add-attr">+ Add Attribute</button>';
            propHtml += '</div>';

            this.$propPanel.html(propHtml);

            // Bind property changes
            this.$propPanel.find('.sha-text-input').on('change', function () {
                self.updateElementText($(this).val());
            });

            this.$propPanel.find('.sha-css-input').on('change', function () {
                var prop = $(this).data('prop');
                var val = $(this).val();
                self.updateElementCSS(prop, val);
            });

            // Color picker sync
            this.$propPanel.find('.sha-color-picker').on('input', function () {
                var prop = $(this).data('prop');
                var val = $(this).val();
                var $textInput = $(this).closest('.sha-field-row').find('.sha-css-input');
                if ($textInput.length) $textInput.val(val);
                self.updateElementCSS(prop, val);
            });

            // Number + unit controls
            this.$propPanel.find('.sha-num-input, .sha-unit-select').on('change', function () {
                var $row = $(this).closest('.sha-field-row');
                var prop = $row.find('.sha-num-input').data('prop');
                var num = $row.find('.sha-num-input').val();
                var unit = $row.find('.sha-unit-select').val();
                var val = /^[\d.-]+$/.test(num) ? num + unit : num;
                self.updateElementCSS(prop, val);
            });

            // Property select dropdowns
            this.$propPanel.find('.sha-prop-select').on('change', function () {
                var prop = $(this).data('prop');
                var val = $(this).val();
                self.updateElementCSS(prop, val);
            });

            // Range sliders
            this.$propPanel.find('.sha-range-input').on('input', function () {
                var prop = $(this).data('prop');
                var val = $(this).val();
                $(this).closest('.sha-range-control').find('.sha-range-value').text(val);
                self.updateElementCSS(prop, val);
            });

            // Property reset buttons
            this.$propPanel.find('.sha-prop-reset').on('click', function () {
                var prop = $(this).data('prop');
                self.resetElementCSS(prop);
                if (self.state.selectedElement) {
                    self.displayElementProperties(self.state.selectedElement);
                }
            });

            // Accordion toggle (delegated)
            this.$propPanel.on('click', '.sha-accordion-header', function () {
                var $header = $(this);
                var $body = $header.next('.sha-accordion-body');
                $header.toggleClass('expanded collapsed');
                $body.slideToggle(150);
                $header.find('.sha-accordion-icon').text($header.hasClass('expanded') ? '\u2212' : '+');
            });

            // Pseudo-state tab switching
            this.$propPanel.on('click', '.sha-pseudo-tab', function () {
                var state = $(this).data('state');
                $(this).closest('.sha-pseudo-section').find('.sha-pseudo-tab').removeClass('active');
                $(this).addClass('active');
                $(this).closest('.sha-pseudo-section').find('.sha-pseudo-fields').hide();
                $(this).closest('.sha-pseudo-section').find('.sha-pseudo-fields[data-state="' + state + '"]').show();
            });

            // Pseudo-state inputs
            this.$propPanel.find('.sha-pseudo-input, .sha-pseudo-color').on('change input', function () {
                var $row = $(this).closest('.sha-field-row');
                var state = $(this).data('state');
                var prop = $(this).data('prop');
                var val;
                if ($(this).is('.sha-pseudo-color')) {
                    val = $(this).val();
                    $row.find('.sha-pseudo-input').val(val);
                } else if ($(this).is('.sha-pseudo-input') && $(this).is('input[type="range"]')) {
                    val = $(this).val();
                    $row.find('.sha-range-value').text(val);
                } else {
                    val = $(this).val();
                }
                self.updateElementPseudoCSS(state, prop, val);
            });

            // Pseudo-state reset
            this.$propPanel.on('click', '.sha-pseudo-section .sha-prop-reset', function () {
                var state = $(this).data('state');
                var prop = $(this).data('prop');
                self.resetElementPseudoCSS(state, prop);
                if (self.state.selectedElement) {
                    self.displayElementProperties(self.state.selectedElement);
                }
            });

            // Inline attribute changes
            this.$propPanel.find('.sha-attr-inline').on('change', function () {
                var key = $(this).data('attr');
                var val = $(this).val();
                self.updateElementAttr(key, val);
            });

            // Delete attribute
            this.$propPanel.find('.sha-attr-del').on('click', function () {
                var key = $(this).data('attr');
                var $group = $(this).closest('.sha-field-group');
                self.confirmDialog('Remove attribute "' + key + '"?', function (confirmed) {
                    if (confirmed) {
                        self.updateElementAttr(key, '');
                        $group.remove();
                    }
                });
            });

            // Add CSS property button
            this.$propPanel.find('.sha-btn-add-prop').on('click', function () {
                self.showAddCSSPropertyDialog();
            });

            // Inherited values toggle
            this.$propPanel.find('.sha-inherited-toggle').on('click', function () {
                var body = $(this).next('.sha-inherited-body');
                body.slideToggle(150);
                $(this).find('.sha-toggle-icon').text(body.is(':visible') ? '\u2212' : '+');
            });

            // Add attribute button
            this.$propPanel.find('.sha-btn-add-attr').on('click', function () {
                self.showAddAttributeDialog();
            });

            // Also build the full attributes panel (for the Attributes tab)
            this.buildAttributesPanel(data);
        },

        mergeAttributes: function (data) {
            var merged = {};
            if (data.attributes) {
                for (var k in data.attributes) {
                    if (data.attributes.hasOwnProperty(k)) {
                        merged[k] = data.attributes[k];
                    }
                }
            }
            return merged;
        },

        showAddCSSPropertyDialog: function () {
            var self = this;

            // Remove existing modal if any
            $('.sha-css-prop-overlay').remove();

            var propCategories = {
                'Typography': ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'line-height', 'letter-spacing', 'word-spacing', 'white-space', 'word-break', 'text-align', 'text-decoration', 'text-transform', 'text-shadow', 'text-indent', 'vertical-align', 'direction', 'overflow-wrap', 'hyphens'],
                'Background': ['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-attachment', 'background-clip', 'background-origin', 'background-blend-mode'],
                'Margin': ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
                'Padding': ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
                'Border & Outline': ['border', 'border-width', 'border-style', 'border-color', 'border-radius', 'outline', 'outline-width', 'outline-style', 'outline-color', 'outline-offset', 'border-collapse', 'border-spacing'],
                'Layout': ['display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear', 'visibility', 'overflow', 'overflow-x', 'overflow-y', 'z-index', 'box-sizing', 'resize', 'isolation', 'object-fit', 'object-position'],
                'Flexbox': ['flex', 'flex-direction', 'flex-wrap', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-content', 'align-self', 'justify-content', 'order', 'gap', 'row-gap', 'column-gap'],
                'Grid': ['grid', 'grid-template', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-column', 'grid-row', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end', 'grid-area', 'justify-items', 'align-items', 'place-items', 'place-content', 'place-self'],
                'Size': ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'],
                'Effects': ['opacity', 'transform', 'transform-origin', 'transition', 'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state', 'box-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode', 'cursor', 'pointer-events', 'user-select', 'clip-path'],
                'Content & UI': ['content', 'quotes', 'counter-increment', 'counter-reset', 'list-style', 'list-style-type', 'list-style-position', 'list-style-image', 'appearance', 'caret-color', 'accent-color', 'color-scheme', 'scroll-behavior', 'scrollbar-width', 'scrollbar-color', 'writing-mode', 'text-orientation', 'caption-side', 'table-layout', 'empty-cells']
            };

            var catKeys = Object.keys(propCategories);

            var html = '';
            // Build all category HTML for the list
            var listHtml = '';
            for (var ci = 0; ci < catKeys.length; ci++) {
                var cn = catKeys[ci];
                var props = propCategories[cn].slice().sort();
                listHtml += '<div class="sha-css-prop-category" data-category="' + cn + '">';
                listHtml += '<div class="sha-css-prop-cat-label">' + cn + '</div>';
                for (var pi = 0; pi < props.length; pi++) {
                    listHtml += '<div class="sha-css-prop-item" data-prop="' + props[pi] + '" tabindex="-1">' +
                        '<span class="sha-css-prop-name">' + props[pi] + '</span>' +
                        '</div>';
                }
                listHtml += '</div>';
            }

            html += '<div class="sha-css-prop-overlay">';
            html += '<div class="sha-css-prop-modal">';
            html += '<div class="sha-css-prop-header">';
            html += '<h3>Add CSS Property</h3>';
            html += '<button class="sha-css-prop-close" title="Close">&times;</button>';
            html += '</div>';
            html += '<div class="sha-css-prop-search-wrap">';
            html += '<svg class="sha-css-prop-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
            html += '<input type="text" class="sha-css-prop-search" placeholder="Search CSS properties..." autocomplete="off" />';
            html += '</div>';
            html += '<div class="sha-css-prop-list">' + listHtml + '</div>';
            html += '<div class="sha-css-prop-value-wrap">';
            html += '<div class="sha-css-prop-value-header">Value</div>';
            html += '<input type="text" class="sha-css-prop-value" placeholder="Enter CSS value..." disabled spellcheck="false" />';
            html += '</div>';
            html += '<div class="sha-css-prop-footer">';
            html += '<button class="sha-btn sha-btn-cancel sha-css-prop-cancel">Cancel</button>';
            html += '<button class="sha-btn sha-btn-primary sha-css-prop-apply" disabled>Apply</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';

            var $overlay = $(html);
            $('body').append($overlay);

            // Trigger enter animation
            requestAnimationFrame(function () {
                $overlay.addClass('active');
            });

            // Focus search after animation
            setTimeout(function () {
                $overlay.find('.sha-css-prop-search').focus();
            }, 200);

            var selectedProp = null;

            // === FILTER ON SEARCH ===
            $overlay.on('input', '.sha-css-prop-search', function () {
                var q = $(this).val().toLowerCase().trim();

                if (!q) {
                    $overlay.find('.sha-css-prop-category').show();
                    $overlay.find('.sha-css-prop-item').show();
                    $overlay.find('.sha-css-prop-cat-label').show();
                    return;
                }

                $overlay.find('.sha-css-prop-item').each(function () {
                    var name = $(this).data('prop').toLowerCase();
                    $(this).toggle(name.indexOf(q) !== -1);
                });

                $overlay.find('.sha-css-prop-category').each(function () {
                    var $cat = $(this);
                    var visible = $cat.find('.sha-css-prop-item:visible').length > 0;
                    $cat.toggle(visible);
                });
            });

            // === SELECT PROPERTY ===
            $overlay.on('click', '.sha-css-prop-item', function () {
                $overlay.find('.sha-css-prop-item').removeClass('selected');
                $(this).addClass('selected');
                selectedProp = $(this).data('prop');
                $overlay.find('.sha-css-prop-value').prop('disabled', false).focus().val('');
                $overlay.find('.sha-css-prop-apply').prop('disabled', false);
                $overlay.find('.sha-css-prop-search').val(selectedProp);
                // Reset list to show all
                $overlay.find('.sha-css-prop-item').show();
                $overlay.find('.sha-css-prop-category').show();
                $overlay.find('.sha-css-prop-cat-label').show();
            });

            // === APPLY ===
            $overlay.on('click', '.sha-css-prop-apply', function () {
                if (!selectedProp) return;
                var val = $overlay.find('.sha-css-prop-value').val().trim();
                if (!val) {
                    $overlay.find('.sha-css-prop-value').focus();
                    return;
                }
                self.updateElementCSS(selectedProp, val);
                var sel = self.state.selectedElement;
                if (sel) {
                    if (!sel.explicitCSS) sel.explicitCSS = {};
                    sel.explicitCSS[selectedProp] = val;
                    self.displayElementProperties(sel);
                }
                $overlay.remove();
                $(document).off('.sha-css-prop');
            });

            // === CANCEL / CLOSE ===
            $overlay.on('click', '.sha-css-prop-cancel, .sha-css-prop-close', function () {
                $overlay.remove();
                $(document).off('.sha-css-prop');
            });

            // Close on overlay backdrop click
            $overlay.on('click', function (e) {
                if (e.target === this) {
                    $overlay.remove();
                    $(document).off('.sha-css-prop');
                }
            });

            // === KEYBOARD NAVIGATION ===
            $overlay.on('keydown', '.sha-css-prop-search', function (e) {
                var $items = $overlay.find('.sha-css-prop-item:visible');
                var $sel = $overlay.find('.sha-css-prop-item.selected');

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    var idx = $items.index($sel);
                    var next = Math.min(idx + 1, $items.length - 1);
                    $items.removeClass('selected').eq(next).addClass('selected');
                    $items.eq(next)[0].scrollIntoView({ block: 'nearest' });
                    selectedProp = $items.eq(next).data('prop');
                    $overlay.find('.sha-css-prop-value').prop('disabled', false).val('');
                    $overlay.find('.sha-css-prop-apply').prop('disabled', false);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    var idx2 = $items.index($sel);
                    var prev = Math.max(idx2 - 1, 0);
                    $items.removeClass('selected').eq(prev).addClass('selected');
                    $items.eq(prev)[0].scrollIntoView({ block: 'nearest' });
                    selectedProp = $items.eq(prev).data('prop');
                    $overlay.find('.sha-css-prop-value').prop('disabled', false).val('');
                    $overlay.find('.sha-css-prop-apply').prop('disabled', false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    var $selItem = $overlay.find('.sha-css-prop-item.selected');
                    if ($selItem.length) {
                        $selItem.trigger('click');
                    } else if ($items.length === 1) {
                        $items.first().trigger('click');
                    } else if ($(this).val().trim()) {
                        selectedProp = $(this).val().trim();
                        $overlay.find('.sha-css-prop-value').prop('disabled', false).focus().val('');
                        $overlay.find('.sha-css-prop-apply').prop('disabled', false);
                    }
                }
            });

            // Enter in value input triggers apply
            $overlay.on('keydown', '.sha-css-prop-value', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    $overlay.find('.sha-css-prop-apply').trigger('click');
                }
            });

            // Escape to close
            $(document).on('keydown.sha-css-prop', function (e) {
                if (e.key === 'Escape') {
                    $overlay.remove();
                    $(document).off('.sha-css-prop');
                }
            });
        },

        showAddAttributeDialog: function () {
            var self = this;
            var attrName = prompt('Enter attribute name:');
            if (!attrName || attrName.trim() === '') return;
            attrName = attrName.trim();
            var attrValue = prompt('Enter value for "' + attrName + '":');
            if (attrValue === null) return;

            self.postToIframe({ type: 'update-attr', key: attrName, value: attrValue || '' });
            self.markDirty();

            // Refresh element data from iframe
            this.postToIframe({ type: 'refresh-selected' });
        },

        buildAttributesPanel: function (data) {
            var allAttrs = this.mergeAttributes(data);
            var attrKeys = Object.keys(allAttrs);
            var attrHtml = '';

            for (var i = 0; i < attrKeys.length; i++) {
                var k = attrKeys[i];
                attrHtml += '<div class="sha-field-group">';
                attrHtml += '<label>' + this.escHtml(k) + '</label>';
                attrHtml += '<div class="sha-attr-row">';
                attrHtml += '<input type="text" class="sha-attr-input" data-attr="' + this.escAttr(k) + '" value="' + this.escAttr(allAttrs[k]) + '" />';
                attrHtml += '<button class="sha-attr-del" data-attr="' + this.escAttr(k) + '" title="Remove attribute">&times;</button>';
                attrHtml += '</div></div>';
            }

            // Add attribute button
            attrHtml += '<div class="sha-new-attr-row">';
            attrHtml += '<button class="sha-btn sha-btn-add-attr">+ Add Attribute</button>';
            attrHtml += '</div>';

            if (attrKeys.length === 0) {
                attrHtml = '<div class="sha-panel-placeholder"><p>No attributes yet. Click "+ Add Attribute" to add one.</p></div>'
                    + '<div class="sha-new-attr-row" style="padding:12px 16px;">'
                    + '<button class="sha-btn sha-btn-add-attr">+ Add Attribute</button>'
                    + '</div>';
            }

            this.$attrPanel.html(attrHtml);

            var self = this;
            this.$attrPanel.find('.sha-attr-input').on('change', function () {
                var key = $(this).data('attr');
                var val = $(this).val();
                self.updateElementAttr(key, val);
            });

            this.$attrPanel.find('.sha-attr-del').on('click', function () {
                var key = $(this).data('attr');
                var $group = $(this).closest('.sha-field-group');
                self.confirmDialog('Remove attribute "' + key + '"?', function (confirmed) {
                    if (confirmed) {
                        self.updateElementAttr(key, '');
                        $group.remove();
                    }
                });
            });

            this.$attrPanel.find('.sha-btn-add-attr').on('click', function () {
                self.showAddAttributeDialog();
            });
        },

        /* ===================================================
               SYNC HTML FROM IFRAME LIVE DOM
               =================================================== */
        syncHtmlFromIframe: function () {
            try {
                var iframe = this.$previewFrame[0];
                if (!iframe || !iframe.contentDocument) return;
                var body = iframe.contentDocument.body;
                var html = body.innerHTML;

                // Strip builder-injected overlays by finding the marker
                var marker = '<div id="sha-inspector-overlay"';
                var idx = html.indexOf(marker);
                if (idx !== -1) {
                    html = html.substring(0, idx);
                }
                // Strip any leftover scripts added by the builder
                html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

                this.$htmlInput.val(html.trim());
            } catch (e) {
                console.error('[SHA BUILDER] syncHtmlFromIframe error:', e);
            }
        },

        /* ===================================================
               UPDATE ELEMENT IN IFRAME
               =================================================== */
        postToIframe: function (data) {
            try {
                var iframe = this.$previewFrame[0];
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(data, '*');
                }
            } catch (e) {}
        },

        updateElementText: function (value) {
            this.postToIframe({ type: 'update-text', value: value });

            // Sync live iframe DOM back to HTML textarea so edits persist on save.
            // Wait briefly for the iframe to process the postMessage.
            var self = this;
            setTimeout(function () {
                self.syncHtmlFromIframe();
            }, 50);

            this.markDirty();
        },

        updateElementCSS: function (prop, value) {
            this.postToIframe({ type: 'update-style', prop: prop, value: value });

            var selector = this.state.currentSelector;
            if (!selector) return;

            if (!this.state.overrides[selector]) {
                this.state.overrides[selector] = {};
            }
            this.state.overrides[selector][prop] = value;

            // Sync override block to ensure persistence (no direct edit of user's CSS)
            var newCss = this.$cssInput.val();
            var marker = '/* === SHA BUILDER OVERRIDES === */';
            var markerIdx = newCss.indexOf(marker);
            var ruleLine = selector + ' { ' + prop + ': ' + value + ' !important; }';

            if (markerIdx === -1) {
                newCss += '\n\n' + marker + '\n' + ruleLine + '\n';
            } else {
                // Check if this selector already has a rule in the override block
                var escSel = this.escapeRegex(selector);
                var selRegex = new RegExp(escSel + '\\s*\\{');
                var block = newCss.substring(markerIdx);
                if (selRegex.test(block)) {
                    // Update existing rule's property value
                    var propInBlock = new RegExp(
                        '(' + escSel + '\\s*\\{[^}]*' + this.escapeRegex(prop) + '\\s*:\\s*)[^;!]+(!important)?\\s*;', 'i'
                    );
                    block = block.replace(propInBlock, '$1' + value + ' !important;');
                    // Check if prop exists inside the rule
                    var selBodyRegex = new RegExp(escSel + '\\s*\\{([^}]*)\\}', 'i');
                    var bodyMatch = selBodyRegex.exec(block);
                    if (bodyMatch && bodyMatch[1].indexOf(prop + ':') === -1 && bodyMatch[1].indexOf(prop + ' :') === -1) {
                        // Property not in rule — append it
                        var inner = bodyMatch[1].trim().replace(/;\s*$/, '');
                        block = block.replace(selBodyRegex, selector + ' { ' + inner + '; ' + prop + ': ' + value + ' !important; }');
                    }
                } else {
                    // Append new rule for this selector
                    block += '\n' + ruleLine;
                }
                newCss = newCss.substring(0, markerIdx) + block;
            }

            this.$cssInput.val(newCss);
            this.markDirty();
        },

        updateElementAttr: function (key, value) {
            this.postToIframe({ type: 'update-attr', key: key, value: value });
            this.markDirty();
            var self = this;
            setTimeout(function () {
                self.postToIframe({ type: 'refresh-selected' });
            }, 80);
        },

        resetElementCSS: function (prop) {
            this.postToIframe({ type: 'update-style', prop: prop, value: '' });

            var selector = this.state.currentSelector;
            if (!selector || !this.state.overrides[selector]) return;

            delete this.state.overrides[selector][prop];
            var hasProps = false;
            for (var k in this.state.overrides[selector]) { hasProps = true; break; }
            if (!hasProps) delete this.state.overrides[selector];

            this.syncOverridesToCSS();
            this.markDirty();
        },

        updateElementPseudoCSS: function (pseudoClass, prop, value) {
            var baseSel = this.state.currentSelector;
            if (!baseSel) return;
            var fullSelector = baseSel + ':' + pseudoClass;

            if (!this.state.overrides[fullSelector]) {
                this.state.overrides[fullSelector] = {};
            }
            this.state.overrides[fullSelector][prop] = value;

            this.syncOverridesToCSS();
            this.injectPseudoStyles();
            this.markDirty();
        },

        resetElementPseudoCSS: function (pseudoClass, prop) {
            var baseSel = this.state.currentSelector;
            if (!baseSel) return;
            var fullSelector = baseSel + ':' + pseudoClass;
            if (!this.state.overrides[fullSelector]) return;

            delete this.state.overrides[fullSelector][prop];
            var hasProps = false;
            for (var k in this.state.overrides[fullSelector]) { hasProps = true; break; }
            if (!hasProps) delete this.state.overrides[fullSelector];

            this.syncOverridesToCSS();
            this.injectPseudoStyles();
            this.markDirty();
        },

        injectPseudoStyles: function () {
            try {
                var iframe = this.$previewFrame[0];
                if (!iframe || !iframe.contentDocument) return;
                var doc = iframe.contentDocument;
                var old = doc.getElementById('sha-pseudo-injected');
                if (old) old.remove();

                var css = '';
                for (var sel in this.state.overrides) {
                    if (sel.indexOf(':') === -1) continue;
                    var props = this.state.overrides[sel];
                    css += sel + ' { ';
                    for (var p in props) {
                        css += p + ': ' + props[p] + ' !important; ';
                    }
                    css += '} ';
                }

                if (css) {
                    var style = doc.createElement('style');
                    style.id = 'sha-pseudo-injected';
                    style.textContent = css;
                    doc.head.appendChild(style);
                }
            } catch (e) {}
        },

        /* ===================================================
               SAVE
               =================================================== */
        save: function () {
            // Sync overrides to CSS textarea before saving
            this.syncOverridesToCSS();

            var html = this.$htmlInput.val();
            var css  = this.$cssInput.val();
            var js   = this.$jsInput.val();



            console.log('[SHA BUILDER] Save triggered. html_len=' + html.length + ' css_len=' + css.length + ' js_len=' + js.length + ' post_id=' + this.state.postId + ' overrides=' + Object.keys(this.state.overrides).length);

            this.$saveBtn.prop('disabled', true).find('.sha-btn-label').text(shaBuilder.strings.saving);

            var self = this;
            $.post(shaBuilder.ajaxUrl, {
                action: 'sha_builder_save',
                nonce: shaBuilder.nonce,
                post_id: this.state.postId,
                html: html,
                css: css,
                js: js
            }, function (response) {
                console.log('[SHA BUILDER] Save response:', response);
                if (response.success) {
                    self.showNotice(shaBuilder.strings.saveSuccess, 'success');
                    self.clearDirty();
                    // Verify stored data by loading via AJAX
                    $.post(shaBuilder.ajaxUrl, {
                        action: 'sha_builder_load',
                        nonce: shaBuilder.nonce,
                        post_id: self.state.postId
                    }, function (loadResp) {
                        console.log('[SHA BUILDER] Verify load after save:', loadResp);
                    });
                } else {
                    self.showNotice(response.data && response.data.message ? response.data.message : shaBuilder.strings.saveError, 'error');
                }
            }, 'json').fail(function (jqXHR, textStatus, errorThrown) {
                console.error('[SHA BUILDER] Save AJAX fail:', textStatus, errorThrown);
                self.showNotice(shaBuilder.strings.saveError, 'error');
            }).always(function () {
                self.$saveBtn.prop('disabled', false).find('.sha-btn-label').text(shaBuilder.strings.save);
            });
        },

        /* ===================================================
               NOTICES
               =================================================== */
        showNotice: function (message, type) {
            type = type || 'success';
            var $notice = $('<div class="sha-notice sha-notice-' + type + '">' + message + '</div>');
            $('body').append($notice);
            setTimeout(function () {
                $notice.fadeOut(300, function () { $(this).remove(); });
            }, 3000);
        },

        /* ===================================================
               MODAL & LOADING
               =================================================== */
        showModal: function (message, title) {
            this.$modalMessage.html(message);
            if (title) this.$modalOverlay.find('#sha-modal-title').text(title);
            this.$modalOverlay.fadeIn(150);
            this.$modalConfirm.show();
        },

        hideModal: function () {
            this.$modalOverlay.fadeOut(120);
        },

        confirmDialog: function (message, callback) {
            this._modalCallback = callback;
            this.showModal(message);
        },

        startLoading: function () {
            this.$loadingOverlay.addClass('active');
        },

        stopLoading: function () {
            this.$loadingOverlay.removeClass('active');
        },

        /* ===================================================
               CLOSE HANDLER
               =================================================== */
        handleClose: function (e) {
            if (this.state.isDirty) {
                e.preventDefault();
                var href = this.$closeBtn.attr('href');
                var self = this;
                this.confirmDialog(shaBuilder.strings.unsaved, function (confirmed) {
                    if (confirmed && href) {
                        window.location.href = href;
                    }
                });
                return false;
            }
            return true;
        },

        /* ===================================================
               UTILITIES
               =================================================== */
        escHtml: function (str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
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

        escapeRegex: function (str) {
            return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },

        splitCSSValue: function (val, defaultUnit) {
            defaultUnit = defaultUnit || 'px';
            if (!val) return { num: '', unit: defaultUnit };
            var m = String(val).match(/^(-?[\d.]+)\s*(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)?$/i);
            if (m) return { num: m[1], unit: (m[2] || '').toLowerCase() };
            return { num: val, unit: defaultUnit };
        },

        toHexColor: function (val) {
            if (!val || typeof val !== 'string') return '#000000';
            var hex = val.trim();
            if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
            if (/^#[0-9a-f]{3}$/i.test(hex)) return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
            return null;
        },

        /* ===================================================
           OVERRIDE BLOCK MANAGEMENT
           =================================================== */

        /**
         * Parse override block from CSS textarea into state.overrides.
         * Format: /* === SHA BUILDER OVERRIDES === *\/
         *   selector { prop: val !important; prop2: val2 !important; }
         */
        parseOverridesFromCSS: function () {
            this.state.overrides = {};
            var css = this.$cssInput.val();
            var marker = '/* === SHA BUILDER OVERRIDES === */';
            var idx = css.indexOf(marker);
            if (idx === -1) return;

            var block = css.substring(idx + marker.length);
            var ruleRegex = /([^{]+)\s*\{([^}]*)\}/g;
            var match;

            while ((match = ruleRegex.exec(block)) !== null) {
                var selector = match[1].trim();
                var body = match[2].trim();
                if (!selector || !body) continue;

                if (!this.state.overrides[selector]) {
                    this.state.overrides[selector] = {};
                }

                // Parse property: value pairs
                var parts = body.split(';');
                for (var i = 0; i < parts.length; i++) {
                    var part = parts[i].trim();
                    if (!part) continue;
                    // Matches "prop: val" or "prop: val !important"
                    var propMatch = /^([\w-]+)\s*:\s*(.+?)(?:\s*!important)?\s*$/.exec(part);
                    if (propMatch) {
                        this.state.overrides[selector][propMatch[1]] = propMatch[2].trim();
                    }
                }
            }
        },

        /**
         * Rebuild the override block in CSS textarea from state.overrides.
         * Called before save to ensure persistence.
         */
        syncOverridesToCSS: function () {
            var css = this.$cssInput.val();
            var marker = '/* === SHA BUILDER OVERRIDES === */';
            var overrideCount = 0;

            // Build new override block content
            var block = '\n\n' + marker + '\n';
            for (var sel in this.state.overrides) {
                var props = this.state.overrides[sel];
                var rule = sel + ' { ';
                var count = 0;
                for (var p in props) {
                    rule += p + ': ' + props[p] + ' !important; ';
                    count++;
                }
                rule += '}';
                block += rule + '\n';
                overrideCount += count;
            }

            var markerIdx = css.indexOf(marker);
            if (markerIdx === -1) {
                css += block;
            } else {
                css = css.substring(0, markerIdx) + block;
            }

            this.$cssInput.val(css);
        },
    };

    $(document).ready(function () {
        ShaBuilder.init();
    });

})(jQuery);
