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

if (!function_exists('get_plugin_data')) {
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
}
// false, false = no markup, no translation so we get raw strings
$plugin_data = get_plugin_data(SHA_BUILDER_FILE, false, false);
?>
<div class="wrap">
    <h1><?php esc_html_e('SHA BUILDER Config', 'sha-builder'); ?></h1>

    <div style="background:linear-gradient(135deg,#1e1e2e 0%,#2a2a4a 100%);border-radius:12px;padding:28px;margin:24px 0;max-width:620px;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.12);">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
            <div style="width:46px;height:46px;border-radius:10px;background:linear-gradient(135deg,#f0833a 0%,#e06b20 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>
            </div>
            <div>
                <h2 style="margin:0;font-size:17px;font-weight:700;color:#fff;">Sha Builder</h2>
                <p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">v<?php echo esc_html($plugin_data['Version']); ?> &middot; <?php esc_html_e('by', 'sha-builder'); ?> <?php echo esc_html($plugin_data['Author']); ?></p>
            </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <span style="background:rgba(255,255,255,0.07);border-radius:20px;padding:4px 14px;font-size:12px;color:rgba(255,255,255,0.7);display:inline-flex;align-items:center;gap:6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Hyderabad, India
            </span>
            <span style="background:rgba(255,255,255,0.07);border-radius:20px;padding:4px 14px;font-size:12px;color:rgba(255,255,255,0.7);display:inline-flex;align-items:center;gap:6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <?php esc_html_e('Coding since 2014', 'sha-builder'); ?>
            </span>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <a href="https://www.linkedin.com/in/muhammed-shariq-ahmed-78199b158/" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#0a66c2;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;transition:opacity 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
            </a>
            <a href="https://www.upwork.com/freelancers/~0142acdc12184086c7" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#108a00;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;transition:opacity 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-.232c.883-.942 1.618-1.533 2.797-1.533.951 0 1.787.377 2.357 1.122.572.749.692 1.739.692 2.356v.514h-1zm1.645-2.606c-.724-.79-1.766-1.162-2.942-1.162-1.424 0-2.79.444-3.978 1.457l.656.753.001-.001c.992-.747 2.063-1.196 3.322-1.196.848 0 1.62.229 2.206.696.483.384.859.914 1.047 1.58-.28-.086-.582-.127-.914-.127h-4.011c-1.345 0-3.014.715-3.014 2.666 0 .398.079.767.233 1.082.387.802 1.228 1.294 2.306 1.294 1.444 0 2.478-.469 3.203-1.066v.002c.288-.237.607-.538.994-.946h1.25v-1.08c-.003-.952-.266-2.067-1.145-2.957l-.009-.009zm-5.443 5.043c-.223-.342-.342-.761-.342-1.193 0-.46.13-.88.381-1.242l.007-.009c.28-.401.691-.679 1.175-.822.314-.092.619-.144.895-.144h3.935c.315 0 .619.047.902.14v.002c.397.131.749.355 1.027.658.355.389.554.868.554 1.417 0 .553-.201 1.038-.563 1.428-.286.307-.648.535-1.054.666-.285.092-.579.139-.866.139H15.97c-.3 0-.602-.045-.89-.139-.423-.138-.801-.381-1.104-.742l-.213-.18zM12 22.886c-4.202 0-7.818-2.648-9.209-6.36L0 8.101C0 4.232 3.582.886 8.001.886h4C16.419.886 20 4.232 20 8.101v.002l-2.791 8.424c-1.393 3.712-5.009 6.359-9.209 6.359zM8.001 2.886c-3.039 0-5.506 2.34-5.506 5.215v.002l2.79 8.424c1.056 2.816 3.842 4.887 6.715 4.887 3.04 0 5.508-2.34 5.508-5.216v-.002l-2.789-8.424c-1.057-2.816-3.842-4.887-6.716-4.887H8.001v.001z"/></svg>
                Upwork
            </a>
            <a href="<?php echo esc_url($plugin_data['PluginURI']); ?>" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;transition:background 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <?php esc_html_e('Plugin Page', 'sha-builder'); ?>
            </a>
        </div>
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
