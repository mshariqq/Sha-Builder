<?php
if (!defined('ABSPATH')) {
    exit;
}

$global_css = get_option('sha_builder_global_css', '');
$global_js  = get_option('sha_builder_global_js', '');
?>
<div class="wrap">
    <h1><?php esc_html_e('Global CSS & JS', 'sha-builder'); ?></h1>
    <p><?php esc_html_e('Code entered here will be loaded on every page of your site, including inside the page builder preview.', 'sha-builder'); ?></p>

    <form method="post" action="options.php" style="max-width:800px;">
        <?php settings_fields('sha_builder_globals_settings'); ?>

        <h2><?php esc_html_e('Global CSS', 'sha-builder'); ?></h2>
        <p class="description"><?php esc_html_e('Loaded in the <head> on every page.', 'sha-builder'); ?></p>
        <textarea name="sha_builder_global_css" id="sha_builder_global_css" rows="12" style="width:100%;font-family:Consolas,Monaco,monospace;font-size:13px;tab-size:4;" spellcheck="false"><?php echo esc_textarea($global_css); ?></textarea>

        <h2><?php esc_html_e('Global JS', 'sha-builder'); ?></h2>
        <p class="description"><?php esc_html_e('Loaded in the footer on every page.', 'sha-builder'); ?></p>
        <textarea name="sha_builder_global_js" id="sha_builder_global_js" rows="12" style="width:100%;font-family:Consolas,Monaco,monospace;font-size:13px;tab-size:4;" spellcheck="false"><?php echo esc_textarea($global_js); ?></textarea>

        <?php submit_button(); ?>
    </form>
</div>
