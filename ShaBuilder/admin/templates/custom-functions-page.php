<?php
if (!defined('ABSPATH')) {
    exit;
}

$global_php = get_option('sha_builder_global_php', '');
?>
<div class="wrap">
    <h1><?php esc_html_e('Custom Functions', 'sha-builder'); ?></h1>
    <p><?php esc_html_e('PHP code entered here will run on every page load, just like functions.php of a theme. You can add WordPress hooks, filters, shortcodes, and any custom PHP logic.', 'sha-builder'); ?></p>

    <form method="post" action="options.php" style="max-width:800px;">
        <?php settings_fields('sha_builder_globals_settings'); ?>

        <h2><?php esc_html_e('Custom PHP', 'sha-builder'); ?></h2>
        <p class="description"><?php esc_html_e('Executed on every page load. Note: &lt;?php tags are not required — just raw PHP statements. Use with caution; a fatal error here can break your site.', 'sha-builder'); ?></p>
        <textarea name="sha_builder_global_php" id="sha_builder_global_php" rows="24" style="width:100%;font-family:Consolas,Monaco,monospace;font-size:13px;tab-size:4;" spellcheck="false"><?php echo esc_textarea($global_php); ?></textarea>

        <?php submit_button(); ?>
    </form>
</div>
