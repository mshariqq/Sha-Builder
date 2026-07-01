<?php
if (!defined('ABSPATH')) {
    exit;
}

$active_header = get_option('sha_builder_active_header', 0);
$active_footer = get_option('sha_builder_active_footer', 0);

$headers = get_posts(array(
    'post_type'      => 'sha_header',
    'posts_per_page' => -1,
    'post_status'    => 'publish',
    'orderby'        => 'title',
    'order'          => 'ASC',
));

$footers = get_posts(array(
    'post_type'      => 'sha_footer',
    'posts_per_page' => -1,
    'post_status'    => 'publish',
    'orderby'        => 'title',
    'order'          => 'ASC',
));

$plugin_data = get_plugin_data(SHA_BUILDER_FILE);
?>
<div class="wrap">
    <h1><?php esc_html_e('SHA BUILDER Config', 'sha-builder'); ?></h1>

    <div style="background:#fff;border:1px solid #ccd0d4;padding:20px;margin:20px 0;max-width:600px;">
        <h2 style="margin-top:0;"><?php esc_html_e('Plugin Information', 'sha-builder'); ?></h2>
        <table class="form-table" style="clear:none;">
            <tr>
                <th style="width:140px;"><?php esc_html_e('Plugin Name', 'sha-builder'); ?></th>
                <td><strong>Sha Builder</strong></td>
            </tr>
            <tr>
                <th><?php esc_html_e('Version', 'sha-builder'); ?></th>
                <td><?php echo esc_html($plugin_data['Version']); ?></td>
            </tr>
            <tr>
                <th><?php esc_html_e('Author', 'sha-builder'); ?></th>
                <td>
                    <a href="<?php echo esc_url($plugin_data['AuthorURI']); ?>" target="_blank">
                        <?php echo esc_html($plugin_data['Author']); ?>
                    </a>
                </td>
            </tr>
            <tr>
                <th><?php esc_html_e('Support', 'sha-builder'); ?></th>
                <td>
                    <?php esc_html_e('For support, please visit', 'sha-builder'); ?>
                    <a href="<?php echo esc_url($plugin_data['PluginURI']); ?>" target="_blank">
                        <?php echo esc_url($plugin_data['PluginURI']); ?>
                    </a>
                </td>
            </tr>
        </table>
    </div>

    <form method="post" action="options.php" style="max-width:600px;">
        <?php settings_fields('sha_builder_settings'); ?>
        <h2><?php esc_html_e('Header / Footer Assignment', 'sha-builder'); ?></h2>
        <p><?php esc_html_e('Select which builder templates to use as the site-wide header and footer. These will replace your theme\'s default header and footer on all pages.', 'sha-builder'); ?></p>
        <table class="form-table">
            <tr>
                <th scope="row"><label for="sha_builder_active_header"><?php esc_html_e('Active Header', 'sha-builder'); ?></label></th>
                <td>
                    <select name="sha_builder_active_header" id="sha_builder_active_header">
                        <option value=""><?php esc_html_e('— Theme Default —', 'sha-builder'); ?></option>
                        <?php foreach ($headers as $header) : ?>
                            <option value="<?php echo intval($header->ID); ?>" <?php selected($active_header, $header->ID); ?>>
                                <?php echo esc_html($header->post_title); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description"><?php esc_html_e('Choose a header template to replace the theme header.', 'sha-builder'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="sha_builder_active_footer"><?php esc_html_e('Active Footer', 'sha-builder'); ?></label></th>
                <td>
                    <select name="sha_builder_active_footer" id="sha_builder_active_footer">
                        <option value=""><?php esc_html_e('— Theme Default —', 'sha-builder'); ?></option>
                        <?php foreach ($footers as $footer) : ?>
                            <option value="<?php echo intval($footer->ID); ?>" <?php selected($active_footer, $footer->ID); ?>>
                                <?php echo esc_html($footer->post_title); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description"><?php esc_html_e('Choose a footer template to replace the theme footer.', 'sha-builder'); ?></p>
                </td>
            </tr>
        </table>
        <?php submit_button(); ?>
    </form>
</div>
