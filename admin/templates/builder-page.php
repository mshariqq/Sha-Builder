<?php
if (!defined('ABSPATH')) {
    exit;
}
?><!DOCTYPE html>
<html <?php language_attributes(); ?> class="sha-builder-active">
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo esc_html__('Sha Builder', 'sha-builder'); ?> — <?php echo esc_html($post->post_title); ?></title>
    <?php wp_head(); ?>
    <?php wp_print_styles('sha-builder-builder'); ?>
    <?php wp_print_scripts('jquery'); ?>
    <style>
        html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#1e1e2e}
        *,:before,:after{box-sizing:border-box}
    </style>
</head>
<body class="sha-builder-body wp-core-ui">
    <div class="sha-builder-wrap">

        <!-- TOP BAR -->
        <div class="sha-top-bar">
            <div class="sha-top-left">
                <span class="sha-logo">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>
                    <span class="sha-logo-text">Sha Builder</span>
                </span>
                <span class="sha-page-title"><?php echo esc_html($post->post_title); ?></span>
                <span class="sha-post-id">#<?php echo intval($post->ID); ?></span>
            </div>
            <div class="sha-top-right">
                <button id="sha-render-btn" class="sha-btn sha-btn-render">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <?php esc_html_e('Render', 'sha-builder'); ?>
                </button>
                <button id="sha-save-btn" class="sha-btn sha-btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    <span class="sha-btn-label"><?php esc_html_e('Save', 'sha-builder'); ?></span>
                </button>
                <a href="<?php echo esc_url(admin_url('edit.php?post_type=' . $post->post_type)); ?>" class="sha-btn sha-btn-close" title="<?php esc_attr_e('Close', 'sha-builder'); ?>">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </a>
            </div>
        </div>

        <!-- BUILDER CONTENT -->
        <div class="sha-builder-content">

            <!-- LEFT PANEL -->
            <div class="sha-left-panel">
                <div class="sha-tabs">
                    <button class="sha-tab-btn active" data-tab="code"><?php esc_html_e('Code', 'sha-builder'); ?></button>
                    <button class="sha-tab-btn" data-tab="properties"><?php esc_html_e('Properties', 'sha-builder'); ?></button>
                    <button class="sha-tab-btn" data-tab="attributes"><?php esc_html_e('Attributes', 'sha-builder'); ?></button>
                </div>

                <div class="sha-panel-scroll">
                    <!-- CODE PANEL -->
                    <div id="code-panel" class="sha-panel-content active">
                        <div class="sha-code-section">
                            <div class="sha-code-header">
                                <span class="sha-code-lang html">HTML</span>
                            </div>
                            <textarea id="sha-html-code" class="sha-code-editor html" spellcheck="false" placeholder="<?php esc_attr_e('<div>Your HTML here...</div>', 'sha-builder'); ?>"><?php echo esc_textarea($saved_data['html']); ?></textarea>
                        </div>
                        <div class="sha-code-section">
                            <div class="sha-code-header">
                                <span class="sha-code-lang css">CSS</span>
                            </div>
                            <textarea id="sha-css-code" class="sha-code-editor css" spellcheck="false" placeholder="<?php esc_attr_e('/* Your CSS here */', 'sha-builder'); ?>"><?php echo esc_textarea($saved_data['css']); ?></textarea>
                        </div>
                        <div class="sha-code-section">
                            <div class="sha-code-header">
                                <span class="sha-code-lang js">JS</span>
                            </div>
                            <textarea id="sha-js-code" class="sha-code-editor js" spellcheck="false" placeholder="<?php esc_attr_e('// Your JavaScript here...', 'sha-builder'); ?>"><?php echo esc_textarea($saved_data['js']); ?></textarea>
                        </div>
                    </div>

                    <!-- PROPERTIES PANEL -->
                    <div id="properties-panel" class="sha-panel-content">
                        <div class="sha-panel-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6c6c8a" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                            <p><?php esc_html_e('Click an element in the preview to edit its CSS properties.', 'sha-builder'); ?></p>
                        </div>
                    </div>

                    <!-- ATTRIBUTES PANEL -->
                    <div id="attributes-panel" class="sha-panel-content">
                        <div class="sha-panel-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6c6c8a" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <p><?php esc_html_e('Click an element in the preview to edit its attributes.', 'sha-builder'); ?></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT PANEL -->
            <div class="sha-right-panel">
                <div class="sha-preview-toolbar">
                    <span class="sha-preview-label"><?php esc_html_e('Preview', 'sha-builder'); ?></span>
                </div>
                <div class="sha-preview-container">
                    <iframe id="sha-preview-frame" class="sha-preview-frame" sandbox="allow-scripts allow-same-origin" loading="lazy"></iframe>
                </div>
            </div>

        </div>
    </div>

    <?php
    wp_print_scripts('sha-builder-builder');
    wp_print_footer_scripts();
    wp_footer();
    ?>
</body>
</html>
