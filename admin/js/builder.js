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
        },

        init: function () {
            this.state.postId = shaBuilder.postId || 0;
            this.cacheDOM();
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

            var inspectorScript = [
                '(function(){',
                'var overlay=document.getElementById("sha-inspector-overlay");',
                'var selected=null;',
                'var lastHovered=null;',
                'function getInfo(el){',
                'var info={tagName:(el.tagName||"").toLowerCase(),id:el.id||"",className:(el.className&&typeof el.className==="string")?el.className:"",attributes:{},textContent:(el.textContent||"").trim().substring(0,1000),matchedCSS:{},computedCSS:{}};',
                'for(var i=0;i<(el.attributes||[]).length;i++){var a=el.attributes[i];if(a.name!=="style"){info.attributes[a.name]=a.value}}',
                'var comp=window.getComputedStyle(el);',
                'var rel=["display","width","height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","color","background-color","background","font-size","font-weight","font-family","text-align","line-height","border-top-width","border-right-width","border-bottom-width","border-left-width","border-top-color","border-right-color","border-bottom-color","border-left-color","border-top-style","border-right-style","border-bottom-style","border-left-style","border-radius","box-shadow","opacity","position","top","left","right","bottom","float","overflow","z-index","transform","transition","text-decoration","letter-spacing","word-spacing","white-space","vertical-align","list-style","flex-direction","flex-wrap","justify-content","align-items","gap","margin","padding","border","outline","min-width","min-height","max-width","max-height","cursor","user-select","pointer-events","visibility","filter","backdrop-filter","clip-path"];',
                'for(var p=0;p<rel.length;p++){var v=comp.getPropertyValue(rel[p]);if(v&&v!=="none"&&v!=="normal"&&v!=="0px"&&v!=="auto"&&v!=="visible"&&v!=="static"){info.computedCSS[rel[p]]=v}}',
                'try{var sheets=document.styleSheets;for(var s=0;s<sheets.length;s++){var rules;try{rules=sheets[s].cssRules||sheets[s].rules}catch(e){continue}if(!rules)continue;for(var r=0;r<rules.length;r++){try{if(rules[r].type===1&&el.matches(rules[r].selectorText)){for(var k=0;k<rules[r].style.length;k++){var pr=rules[r].style[k];info.matchedCSS[pr]=rules[r].style.getPropertyValue(pr).trim()}}}catch(e){}}}}catch(e){}',
                'return info',
                '}',
                'document.addEventListener("mouseover",function(e){',
                'var el=e.target;if(!el||el===overlay||el===document.body||el===document.documentElement){overlay.style.display="none";return}',
                'lastHovered=el;var r=el.getBoundingClientRect();',
                'overlay.style.display="block";',
                'overlay.style.top=(r.top+window.scrollY)+"px";',
                'overlay.style.left=(r.left+window.scrollX)+"px";',
                'overlay.style.width=r.width+"px";',
                'overlay.style.height=r.height+"px"',
                '},true);',
                'document.addEventListener("click",function(e){',
                'var el=e.target;if(!el||el===overlay||el===document.body||el===document.documentElement)return;',
                'e.preventDefault();e.stopPropagation();selected=el;',
                'var info=getInfo(el);',
                'window.parent.postMessage({type:"element-selected",data:JSON.stringify(info),selector:getSelector(el)},"*")',
                '},true);',
                'function getSelector(el){if(el.id)return"#"+CSS.escape(el.id);',
                'var path=[];while(el&&el.nodeType===1){var sel=el.tagName.toLowerCase();if(el.id){path.unshift("#"+CSS.escape(el.id));break}',
                'if(el.className&&typeof el.className==="string"){var cls=el.className.trim().split(/\\s+/).filter(function(c){return c.length>0&&!c.startsWith("sha-")}).slice(0,2);if(cls.length)sel+="."+cls.map(function(c){return CSS.escape(c)}).join(".")}',
                'var p=el.parentNode;if(p){var ci=Array.prototype.indexOf.call(p.children,el);sel+=":nth-child("+(ci+1)+")"}',
                'path.unshift(sel);el=el.parentNode}',
                'return path.join(" > ")',
                '}',
                'window.addEventListener("message",function(e){',
                'if(!e.data||!e.data.type||!selected)return;',
                'switch(e.data.type){',
                'case"update-text":selected.textContent=e.data.value;break;',
                'case"update-attr":if(e.data.value===""||e.data.value==null)selected.removeAttribute(e.data.key);else selected.setAttribute(e.data.key,e.data.value);break;',
                'case"update-style":selected.style[e.data.prop]=e.data.value;break;',
                'case"update-inner-html":selected.innerHTML=e.data.value;break;',
                '}',
                '});',
                '})()'
            ].join('');

            var inspectorCSS = [
                '#sha-inspector-overlay{position:absolute;pointer-events:none;border:2px solid #f0833a;z-index:999998;display:none;transition:all 0.08s ease;box-shadow:0 0 0 2px rgba(240,131,58,0.25),inset 0 0 0 1px rgba(240,131,58,0.1);border-radius:2px}',
                '*:hover{cursor:crosshair}'
            ].join('');

            return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
                + '<style>' + inspectorCSS + css + '</style>'
                + '</head><body>'
                + html
                + '<div id="sha-inspector-overlay"></div>'
                + '<script>' + inspectorScript + '<\/script>'
                + (js ? '<script>' + js + '<\/script>' : '')
                + '</body></html>';
        },

        renderPreview: function () {
            var doc = this.buildPreviewDocument();
            var blob = new Blob([doc], { type: 'text/html' });
            var url = URL.createObjectURL(blob);
            this.$previewFrame.attr('src', url);

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

            // Matched CSS properties
            var matchedKeys = Object.keys(data.matchedCSS);
            var computedKeys = Object.keys(data.computedCSS);

            if (matchedKeys.length > 0) {
                propHtml += '<h4>CSS Properties <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#8a8aaa;">(from stylesheet)</span></h4>';
                for (var i = 0; i < matchedKeys.length; i++) {
                    var p = matchedKeys[i];
                    propHtml += '<div class="sha-field-group">';
                    propHtml += '<label>' + this.escHtml(p) + '</label>';
                    propHtml += '<input type="text" class="sha-css-input" data-prop="' + this.escAttr(p) + '" value="' + this.escAttr(data.matchedCSS[p]) + '" />';
                    propHtml += '</div>';
                }
            }

            if (computedKeys.length > 0) {
                if (matchedKeys.length === 0) {
                    propHtml += '<h4>Computed CSS Properties</h4>';
                }
                for (var j = 0; j < computedKeys.length; j++) {
                    var cp = computedKeys[j];
                    if (matchedKeys.indexOf(cp) === -1) {
                        propHtml += '<div class="sha-field-group">';
                        propHtml += '<label>' + this.escHtml(cp) + ' <span style="color:#6c6c8a;font-weight:400;text-transform:none;">(computed)</span></label>';
                        propHtml += '<input type="text" class="sha-css-input sha-computed" data-prop="' + this.escAttr(cp) + '" value="' + this.escAttr(data.computedCSS[cp]) + '" />';
                        propHtml += '</div>';
                    }
                }
            }

            if (matchedKeys.length === 0 && computedKeys.length === 0) {
                propHtml += '<div class="sha-panel-placeholder"><p>No CSS properties found for this element.</p></div>';
            }

            this.$propPanel.html(propHtml);

            // Bind property changes
            var self = this;
            this.$propPanel.find('.sha-text-input').on('change', function () {
                self.updateElementText($(this).val());
            });

            this.$propPanel.find('.sha-css-input').on('change', function () {
                var prop = $(this).data('prop');
                var val = $(this).val();
                self.updateElementCSS(prop, val);
            });

            // Also build attributes panel
            this.buildAttributesPanel(data);
        },

        buildAttributesPanel: function (data) {
            var attrKeys = Object.keys(data.attributes);
            var attrHtml = '';

            if (data.id) {
                attrHtml += '<div class="sha-field-group">';
                attrHtml += '<label>id</label>';
                attrHtml += '<input type="text" class="sha-attr-input" data-attr="id" value="' + this.escAttr(data.id) + '" />';
                attrHtml += '</div>';
            }

            if (data.className) {
                attrHtml += '<div class="sha-field-group">';
                attrHtml += '<label>class</label>';
                attrHtml += '<input type="text" class="sha-attr-input" data-attr="class" value="' + this.escAttr(data.className) + '" />';
                attrHtml += '</div>';
            }

            for (var i = 0; i < attrKeys.length; i++) {
                var k = attrKeys[i];
                if (k === 'id' || k === 'class') continue;
                attrHtml += '<div class="sha-field-group">';
                attrHtml += '<label>' + this.escHtml(k) + '</label>';
                attrHtml += '<input type="text" class="sha-attr-input" data-attr="' + this.escAttr(k) + '" value="' + this.escAttr(data.attributes[k]) + '" />';
                attrHtml += '</div>';
            }

            if (!attrHtml) {
                attrHtml = '<div class="sha-panel-placeholder"><p>No attributes to display.</p></div>';
            }

            this.$attrPanel.html(attrHtml);

            var self = this;
            this.$attrPanel.find('.sha-attr-input').on('change', function () {
                var key = $(this).data('attr');
                var val = $(this).val();
                self.updateElementAttr(key, val);
            });
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
            this.markDirty();
        },

        updateElementCSS: function (prop, value) {
            this.postToIframe({ type: 'update-style', prop: prop, value: value });

            // Also attempt to update the CSS textarea source
            var cssText = this.$cssInput.val();
            if (cssText) {
                var regex = new RegExp('(' + this.escapeRegex(prop) + '\\s*:\\s*)[^;]+(\\s*;)', 'gi');
                var newCss = cssText.replace(regex, '$1' + value + '$2');
                if (newCss !== cssText) {
                    this.$cssInput.val(newCss);
                }
            }

            this.markDirty();
        },

        updateElementAttr: function (key, value) {
            this.postToIframe({ type: 'update-attr', key: key, value: value });
            this.markDirty();
        },

        /* ===================================================
               SAVE
               =================================================== */
        save: function () {
            var html = this.$htmlInput.val();
            var css  = this.$cssInput.val();
            var js   = this.$jsInput.val();

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
                if (response.success) {
                    self.showNotice(shaBuilder.strings.saveSuccess, 'success');
                    self.clearDirty();
                } else {
                    self.showNotice(response.data && response.data.message ? response.data.message : shaBuilder.strings.saveError, 'error');
                }
            }, 'json').fail(function () {
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
    };

    $(document).ready(function () {
        ShaBuilder.init();
    });

})(jQuery);
