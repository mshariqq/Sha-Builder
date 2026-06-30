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
            var doc = this.buildPreviewDocument();
            this.$previewFrame.attr('srcdoc', doc);

            var self = this;
            this.$previewFrame.one('load', function () {
                setTimeout(function () {
                    try {
                        var iframeDoc = self.$previewFrame[0].contentDocument || self.$previewFrame[0].contentWindow.document;
                        if (iframeDoc) {
                            var height = iframeDoc.documentElement.scrollHeight;
                            self.$previewFrame.height(height);
                        }
                    } catch (e) {}
                }, 100);
            });
        },

        /* ===================================================
               IFRAME MESSAGE HANDLER
               =================================================== */
        handleIframeMessage: function (e) {
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

            // Explicit CSS properties — only what is directly set on this element
            var explicitKeys = Object.keys(data.explicitCSS);

            propHtml += '<h4>CSS Properties <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#8a8aaa;">(edit to override inherited)</span></h4>';

            if (explicitKeys.length > 0) {
                for (var i = 0; i < explicitKeys.length; i++) {
                    var p = explicitKeys[i];
                    propHtml += '<div class="sha-field-group">';
                    propHtml += '<label>' + this.escHtml(p) + '</label>';
                    propHtml += '<input type="text" class="sha-css-input" data-prop="' + this.escAttr(p) + '" value="' + this.escAttr(data.explicitCSS[p]) + '" />';
                    propHtml += '</div>';
                }
            } else {
                propHtml += '<div class="sha-panel-placeholder" style="padding:16px;"><p>No explicit styles — this element inherits all values.</p></div>';
            }

            propHtml += '<div class="sha-new-attr-row">';
            propHtml += '<button class="sha-btn sha-btn-add-attr sha-btn-add-prop">+ Add CSS Property</button>';
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

            // Inline attribute changes
            this.$propPanel.find('.sha-attr-inline').on('change', function () {
                var key = $(this).data('attr');
                var val = $(this).val();
                self.updateElementAttr(key, val);
            });

            // Delete attribute
            this.$propPanel.find('.sha-attr-del').on('click', function () {
                var key = $(this).data('attr');
                if (confirm('Remove attribute "' + key + '"?')) {
                    self.updateElementAttr(key, '');
                    $(this).closest('.sha-field-group').remove();
                }
            });

            // Add CSS property button
            this.$propPanel.find('.sha-btn-add-prop').on('click', function () {
                self.showAddCSSPropertyDialog();
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
            var propName = prompt('Enter CSS property name (e.g., color, margin-top):');
            if (!propName || propName.trim() === '') return;
            propName = propName.trim();
            var propValue = prompt('Enter value for "' + propName + '":');
            if (propValue === null) return;
            propValue = propValue.trim();

            self.updateElementCSS(propName, propValue);
            var sel = this.state.selectedElement;
            if (sel) {
                sel.explicitCSS[propName] = propValue;
                this.displayElementProperties(sel);
            }
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
                if (confirm('Remove attribute "' + key + '"?')) {
                    self.updateElementAttr(key, '');
                    $(this).closest('.sha-field-group').remove();
                }
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

            // Store in state overrides (used for preview rendering)
            if (!this.state.overrides[selector]) {
                this.state.overrides[selector] = {};
            }
            this.state.overrides[selector][prop] = value;

            // 1. Try direct replace in CSS textarea (works for existing CSS properties)
            var cssText = this.$cssInput.val();
            var directRegex = new RegExp('(' + this.escapeRegex(prop) + '\\s*:\\s*)[^;]+(\\s*;)', 'gi');
            var newCss = cssText.replace(directRegex, '$1' + value + ' !important;');
            var changed = (newCss !== cssText);

            // 2. Always sync override block to ensure persistence
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
               CLOSE HANDLER
               =================================================== */
        handleClose: function (e) {
            if (this.state.isDirty) {
                if (!confirm(shaBuilder.strings.unsaved)) {
                    e.preventDefault();
                    return false;
                }
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
