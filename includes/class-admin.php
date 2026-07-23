<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Admin {

    public function __construct() {
        add_action('admin_menu', array($this, 'add_main_admin_menu'), 9);
        add_action('admin_init', array($this, 'register_settings'));
        add_filter('page_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_filter('post_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_filter('sha_header_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_filter('sha_footer_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_filter('sha_template_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_action('add_meta_boxes', array($this, 'add_builder_meta_box'));
        add_action('add_meta_boxes', array($this, 'add_template_post_type_meta_box'));
        add_action('add_meta_boxes', array($this, 'add_template_conditions_meta_box'));
        add_action('add_meta_boxes', array($this, 'add_theme_builder_meta_box'));
        add_action('save_post', array($this, 'save_builder_page_header_footer'), 10, 2);
        add_action('save_post', array($this, 'save_template_post_type'), 10, 2);
        add_filter('manage_sha_template_posts_columns', array($this, 'add_template_post_type_column'));
        add_action('manage_sha_template_posts_custom_column', array($this, 'render_template_post_type_column'), 10, 2);
        add_action('admin_init', array($this, 'add_template_indicator_column_hooks'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_list_assets'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_edit_screen_script'));
        add_filter('redirect_post_location', array($this, 'redirect_after_builder_save'), 10, 2);
        add_filter('admin_body_class', array($this, 'body_class'));
    }

    public function add_template_indicator_column_hooks() {
        $post_types = get_post_types(array('public' => true), 'names');
        foreach ($post_types as $pt) {
            if (strpos($pt, 'sha_') === 0 || $pt === 'attachment') continue;
            add_filter("manage_{$pt}_posts_columns", array($this, 'add_template_indicator_column'));
            add_action("manage_{$pt}_posts_custom_column", array($this, 'render_template_indicator_column'), 10, 2);
        }
    }

    public function add_edit_with_sha_button($actions, $post) {
        if (!current_user_can('edit_with_sha_builder') && !current_user_can('edit_posts')) {
            return $actions;
        }
        $post_type = get_post_type($post);
        if (!in_array($post_type, Sha_Builder_Main::get_supported_post_types(), true)) {
            return $actions;
        }
        $actions['edit_with_sha'] = sprintf(
            '<a href="%s" class="sha-edit-link" style="color:#f0833a;font-weight:600;">%s</a>',
            esc_url(Sha_Builder_Main::instance()->get_builder_url($post->ID)),
            esc_html__('Edit with Sha', 'sha-builder')
        );
        return $actions;
    }

    public function add_builder_meta_box() {
        $post_types = Sha_Builder_Main::get_supported_post_types();
        foreach ($post_types as $pt) {
            add_meta_box(
                'sha_builder_metabox',
                __('Sha Builder', 'sha-builder'),
                array($this, 'render_builder_meta_box'),
                $pt,
                'side',
                'high'
            );
        }
    }

    public function add_template_post_type_meta_box() {
        add_meta_box(
            'sha_template_post_type',
            __('Template Target', 'sha-builder'),
            array($this, 'render_template_post_type_meta_box'),
            'sha_template',
            'side',
            'high'
        );
    }

    public function render_template_post_type_meta_box($post) {
        if (!current_user_can('edit_post', $post->ID) && !current_user_can('edit_posts')) {
            echo '<p>' . esc_html__('You do not have permission.', 'sha-builder') . '</p>';
            return;
        }
        $selected = get_post_meta($post->ID, '_sha_template_post_type', true);
        $is_archive = (bool) get_post_meta($post->ID, '_sha_template_archive', true);
        $post_types = get_post_types(array('public' => true), 'objects');
        $exclude = array('sha_header', 'sha_footer', 'sha_template', 'attachment');
        ?>
        <p style="margin:0 0 8px;font-size:12px;color:#555;">
            <?php esc_html_e('Select the post type this template should apply to:', 'sha-builder'); ?>
        </p>
        <select name="_sha_template_post_type" style="width:100%;">
            <option value=""><?php esc_html_e('&mdash; Select Post Type &mdash;', 'sha-builder'); ?></option>
            <?php foreach ($post_types as $pt) : ?>
                <?php if (in_array($pt->name, $exclude, true)) continue; ?>
                <option value="<?php echo esc_attr($pt->name); ?>" <?php selected($selected, $pt->name); ?>>
                    <?php echo esc_html($pt->labels->singular_name); ?> (<?php echo esc_html($pt->name); ?>)
                </option>
            <?php endforeach; ?>
        </select>
        <p style="margin:12px 0 0;font-size:12px;color:#555;">
            <label>
                <input type="checkbox" name="_sha_template_archive" value="1" <?php checked($is_archive); ?>>
                <?php esc_html_e('Apply to archive pages', 'sha-builder'); ?>
            </label>
        </p>
        <p style="margin:4px 0 0;font-size:11px;color:#999;">
            <?php esc_html_e('When checked, this template also applies to post type archive pages (category, tag, product archive, etc.).', 'sha-builder'); ?>
        </p>
        <?php
    }

    public function add_template_conditions_meta_box() {
        add_meta_box(
            'sha_template_conditions',
            __('Template Conditions', 'sha-builder'),
            array($this, 'render_template_conditions_meta_box'),
            'sha_template',
            'side',
            'default'
        );
    }

    public function render_template_conditions_meta_box($post) {
        if (!current_user_can('edit_post', $post->ID) && !current_user_can('edit_posts')) {
            echo '<p>' . esc_html__('You do not have permission.', 'sha-builder') . '</p>';
            return;
        }
        $selected_pt = get_post_meta($post->ID, '_sha_template_post_type', true);
        if (!$selected_pt) {
            echo '<p style="font-size:12px;color:#999;">' . esc_html__('Select a post type in the Template Target box and save first.', 'sha-builder') . '</p>';
            return;
        }

        $conditions = get_post_meta($post->ID, '_sha_template_conditions', true);
        if (!is_array($conditions)) {
            $conditions = array('apply_all' => true, 'terms' => array());
        }
        $apply_all = !empty($conditions['apply_all']);

        $taxonomies = get_object_taxonomies($selected_pt, 'objects');
        $taxonomies = wp_filter_object_list($taxonomies, array('public' => true));
        $pt_obj = get_post_type_object($selected_pt);
        $pt_label = $pt_obj ? $pt_obj->labels->singular_name : $selected_pt;
        ?>
        <p style="margin:0 0 8px;font-size:12px;color:#555;">
            <?php esc_html_e('Control which content this template applies to:', 'sha-builder'); ?>
        </p>
        <p style="margin:0 0 8px;font-size:12px;">
            <label>
                <input type="checkbox" name="_sha_template_apply_all" value="1" <?php checked($apply_all); ?>>
                <?php echo esc_html(sprintf(__('Apply to all %s', 'sha-builder'), $pt_label)); ?>
            </label>
        </p>
        <div id="sha-template-conditions-terms" style="<?php echo $apply_all ? 'display:none;' : ''; ?>">
            <p style="margin:0 0 6px;font-size:11px;color:#888;">
                <?php esc_html_e('Limit to specific terms (comma-separated slugs):', 'sha-builder'); ?>
            </p>
            <?php if (empty($taxonomies)) : ?>
                <p style="font-size:11px;color:#999;"><?php esc_html_e('No taxonomies found for this post type.', 'sha-builder'); ?></p>
            <?php else : ?>
                <?php foreach ($taxonomies as $tax) :
                    $saved_terms = '';
                    foreach ($conditions['terms'] as $t) {
                        if (isset($t['taxonomy']) && $t['taxonomy'] === $tax->name) {
                            $saved_terms = isset($t['terms']) ? $t['terms'] : '';
                            break;
                        }
                    }
                ?>
                <p style="margin:0 0 6px;font-size:12px;">
                    <label style="display:block;margin-bottom:2px;font-weight:600;color:#555;"><?php echo esc_html($tax->label); ?></label>
                    <input type="text" name="_sha_template_terms[<?php echo esc_attr($tax->name); ?>]" value="<?php echo esc_attr($saved_terms); ?>" placeholder="<?php esc_attr_e('e.g. shoes,boots', 'sha-builder'); ?>" style="width:100%;">
                </p>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
        <script>
        jQuery(function($) {
            $('[name="_sha_template_apply_all"]').on('change', function() {
                $('#sha-template-conditions-terms').toggle(!this.checked);
            });
        });
        </script>
        <?php
    }

    public function add_theme_builder_meta_box() {
        add_meta_box(
            'sha_theme_builder',
            __('Theme Builder', 'sha-builder'),
            array($this, 'render_theme_builder_meta_box'),
            'sha_template',
            'side',
            'default'
        );
    }

    public function render_theme_builder_meta_box($post) {
        if (!current_user_can('edit_post', $post->ID) && !current_user_can('edit_posts')) {
            echo '<p>' . esc_html__('You do not have permission.', 'sha-builder') . '</p>';
            return;
        }
        $locations = get_post_meta($post->ID, '_sha_template_theme_locations', true);
        if (!is_array($locations)) {
            $locations = array();
        }

        $pages = array(
            '404'       => __('404 Page', 'sha-builder'),
            'search'    => __('Search Results', 'sha-builder'),
            'home'      => __('Blog / Posts Page', 'sha-builder'),
            'front_page' => __('Front Page', 'sha-builder'),
            'author'    => __('Author Archives', 'sha-builder'),
            'date'      => __('Date Archives', 'sha-builder'),
        );
        ?>
        <p style="margin:0 0 6px;font-size:12px;color:#555;">
            <?php esc_html_e('Apply this template to special pages:', 'sha-builder'); ?>
        </p>
        <?php foreach ($pages as $key => $label) : ?>
            <p style="margin:0 0 4px;font-size:12px;">
                <label>
                    <input type="checkbox" name="_sha_template_theme_locations[]" value="<?php echo esc_attr($key); ?>" <?php echo in_array($key, $locations, true) ? 'checked' : ''; ?>>
                    <?php echo esc_html($label); ?>
                </label>
            </p>
        <?php endforeach; ?>

        <?php if (class_exists('WooCommerce')) : ?>
            <p style="margin:12px 0 6px;font-size:12px;font-weight:600;color:#555;border-top:1px solid #ddd;padding-top:10px;">
                <?php esc_html_e('WooCommerce Pages:', 'sha-builder'); ?>
            </p>
            <?php
            $wc_pages = array(
                'cart'        => __('Cart', 'sha-builder'),
                'checkout'    => __('Checkout', 'sha-builder'),
                'my_account'  => __('My Account', 'sha-builder'),
            );
            foreach ($wc_pages as $key => $label) : ?>
                <p style="margin:0 0 4px;font-size:12px;">
                    <label>
                        <input type="checkbox" name="_sha_template_theme_locations[]" value="<?php echo esc_attr($key); ?>" <?php echo in_array($key, $locations, true) ? 'checked' : ''; ?>>
                        <?php echo esc_html($label); ?>
                    </label>
                </p>
            <?php endforeach; ?>
        <?php endif; ?>

        <p style="margin:8px 0 0;font-size:11px;color:#999;">
            <?php esc_html_e('A template can apply to multiple locations. The most specific match wins.', 'sha-builder'); ?>
        </p>
        <?php
    }

    public function render_builder_meta_box($post) {
        if (!current_user_can('edit_post', $post->ID) && !current_user_can('edit_posts')) {
            echo '<p>' . esc_html__('You do not have permission.', 'sha-builder') . '</p>';
            return;
        }
        $builder_url = Sha_Builder_Main::instance()->get_builder_url($post->ID);
        $post_type_object = get_post_type_object($post->post_type);
        $label = $post_type_object ? strtolower($post_type_object->labels->singular_name) : __('page', 'sha-builder');

        $selected_header = get_post_meta($post->ID, '_sha_builder_page_header', true);
        $selected_footer = get_post_meta($post->ID, '_sha_builder_page_footer', true);

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
        ?>
        <div style="text-align:center;padding:8px 0;">
            <p style="margin:0 0 12px;font-size:13px;color:#555;">
                <?php echo esc_html(sprintf(__('Edit this %s with the visual Sha Builder.', 'sha-builder'), $label)); ?>
            </p>
            <a href="<?php echo esc_url($builder_url); ?>"
               class="button button-primary sha-builder-launch"
               style="background:#f0833a;border-color:#d9732e;color:#fff;font-weight:600;padding:4px 16px;height:auto;line-height:2.4;font-size:13px;box-shadow:none;width:100%;text-align:center;text-decoration:none;display:inline-block;">
                <?php esc_html_e('Edit with Sha Builder', 'sha-builder'); ?>
            </a>
        </div>
        <div style="padding:8px 0;border-top:1px solid #ddd;margin-top:4px;">
            <?php wp_nonce_field('sha_builder_meta_action', 'sha_builder_meta_nonce'); ?>
            <p style="margin:0 0 8px;font-size:12px;color:#555;">
                <label for="sha-builder-page-header" style="display:block;margin-bottom:4px;font-weight:600;">
                    <?php esc_html_e('Select Header', 'sha-builder'); ?>
                </label>
                <select id="sha-builder-page-header" name="_sha_builder_page_header" style="width:100%;">
                    <option value=""><?php esc_html_e('&mdash; Theme Default &mdash;', 'sha-builder'); ?></option>
                    <?php foreach ($headers as $header) : ?>
                        <option value="<?php echo esc_attr($header->ID); ?>" <?php selected($selected_header, $header->ID); ?>>
                            <?php echo esc_html($header->post_title); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </p>
            <p style="margin:0;font-size:12px;color:#555;">
                <label for="sha-builder-page-footer" style="display:block;margin-bottom:4px;font-weight:600;">
                    <?php esc_html_e('Select Footer', 'sha-builder'); ?>
                </label>
                <select id="sha-builder-page-footer" name="_sha_builder_page_footer" style="width:100%;">
                    <option value=""><?php esc_html_e('&mdash; Theme Default &mdash;', 'sha-builder'); ?></option>
                    <?php foreach ($footers as $footer) : ?>
                        <option value="<?php echo esc_attr($footer->ID); ?>" <?php selected($selected_footer, $footer->ID); ?>>
                            <?php echo esc_html($footer->post_title); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </p>
        </div>
        <?php
    }

    public function save_builder_page_header_footer($post_id, $post) {
        if (!in_array($post->post_type, Sha_Builder_Main::get_supported_post_types(), true)) {
            return;
        }
        if (!isset($_POST['sha_builder_meta_nonce']) || !wp_verify_nonce($_POST['sha_builder_meta_nonce'], 'sha_builder_meta_action')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        if (isset($_POST['_sha_builder_page_header'])) {
            $header_id = intval($_POST['_sha_builder_page_header']);
            if ($header_id && 'publish' === get_post_status($header_id)) {
                update_post_meta($post_id, '_sha_builder_page_header', $header_id);
            } else {
                delete_post_meta($post_id, '_sha_builder_page_header');
            }
        }

        if (isset($_POST['_sha_builder_page_footer'])) {
            $footer_id = intval($_POST['_sha_builder_page_footer']);
            if ($footer_id && 'publish' === get_post_status($footer_id)) {
                update_post_meta($post_id, '_sha_builder_page_footer', $footer_id);
            } else {
                delete_post_meta($post_id, '_sha_builder_page_footer');
            }
        }
    }

    public function save_template_post_type($post_id, $post) {
        if ($post->post_type !== 'sha_template') {
            return;
        }
        if (!isset($_POST['sha_builder_meta_nonce']) || !wp_verify_nonce($_POST['sha_builder_meta_nonce'], 'sha_builder_meta_action')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        if (isset($_POST['_sha_template_post_type'])) {
            $pt = sanitize_text_field($_POST['_sha_template_post_type']);
            if (empty($pt)) {
                delete_post_meta($post_id, '_sha_template_post_type');
            } elseif (post_type_exists($pt)) {
                update_post_meta($post_id, '_sha_template_post_type', $pt);
            }
        }

        $is_archive = isset($_POST['_sha_template_archive']) ? 1 : 0;
        if ($is_archive) {
            update_post_meta($post_id, '_sha_template_archive', 1);
        } else {
            delete_post_meta($post_id, '_sha_template_archive');
        }

        $apply_all = isset($_POST['_sha_template_apply_all']);
        $terms = array();
        if (!$apply_all && isset($_POST['_sha_template_terms']) && is_array($_POST['_sha_template_terms'])) {
            foreach ($_POST['_sha_template_terms'] as $tax => $slugs) {
                $slugs = trim(sanitize_text_field(wp_unslash($slugs)));
                if (!empty($slugs)) {
                    $terms[] = array(
                        'taxonomy' => sanitize_key($tax),
                        'terms'    => $slugs,
                    );
                }
            }
        }
        update_post_meta($post_id, '_sha_template_conditions', array(
            'apply_all' => $apply_all,
            'terms'     => $terms,
        ));

        $locations = isset($_POST['_sha_template_theme_locations']) && is_array($_POST['_sha_template_theme_locations'])
            ? array_map('sanitize_key', $_POST['_sha_template_theme_locations'])
            : array();
        $valid = array('404','search','home','front_page','author','date','cart','checkout','my_account');
        $locations = array_intersect($locations, $valid);
        if (!empty($locations)) {
            update_post_meta($post_id, '_sha_template_theme_locations', $locations);
        } else {
            delete_post_meta($post_id, '_sha_template_theme_locations');
        }
    }

    public function add_template_post_type_column($columns) {
        $columns['sha_template_applies_to'] = __('Applies To', 'sha-builder');
        return $columns;
    }

    public function render_template_post_type_column($column, $post_id) {
        if ($column !== 'sha_template_applies_to') {
            return;
        }
        $pt = get_post_meta($post_id, '_sha_template_post_type', true);
        if (!empty($pt)) {
            $pt_obj = get_post_type_object($pt);
            if ($pt_obj) {
                echo esc_html($pt_obj->labels->singular_name) . ' <code>(' . esc_html($pt) . ')</code>';
            } else {
                echo '<code>' . esc_html($pt) . '</code>';
            }
        } else {
            echo '<em style="color:#999;">' . esc_html__('Not assigned', 'sha-builder') . '</em>';
        }
    }

    public function add_template_indicator_column($columns) {
        $columns['sha_template_indicator'] = __('Template', 'sha-builder');
        return $columns;
    }

    public function render_template_indicator_column($column, $post_id) {
        if ($column !== 'sha_template_indicator') {
            return;
        }
        $frontend = sha_builder()->get_frontend();
        if ($frontend->has_builder_content($post_id)) {
            echo '<span style="color:#f0833a;font-weight:600;">' . esc_html__('Custom', 'sha-builder') . '</span>';
            return;
        }
        $post_type = get_post_type($post_id);
        $template_id = $frontend->get_active_template_for_post_type($post_type);
        if ($template_id) {
            $template = get_post($template_id);
            if ($template) {
                echo '<span style="color:#555;">' . esc_html__('Template:', 'sha-builder') . ' <a href="' . esc_url(admin_url('post.php?action=edit&post=' . $template_id)) . '" style="color:#2271b1;text-decoration:underline;">' . esc_html($template->post_title) . '</a></span>';
                return;
            }
        }
        echo '<span style="color:#bbb;">&mdash;</span>';
    }

    public function enqueue_edit_screen_script($hook) {
        if (!in_array($hook, array('post.php', 'post-new.php'), true)) {
            return;
        }
        $screen = get_current_screen();
        if (!$screen || !in_array($screen->post_type, Sha_Builder_Main::get_supported_post_types(), true)) {
            return;
        }

        $script = '
        jQuery(function($) {
            var $btn = $("#sha_builder_metabox .sha-builder-launch");
            if (!$btn.length) return;

            $btn.on("click", function(e) {
                var $form = $("#post");
                if (!$form.length) return;

                var isNew = $("body.post-new-php").length > 0;
                var isDraft = $("#original_publish").val() === "Draft" || $("#original_publish").val() === "Save Draft";

                if (isNew || isDraft) {
                    e.preventDefault();
                    if (!confirm("' . esc_js(__('Save as draft and open the builder?', 'sha-builder')) . '")) {
                        return;
                    }
                    $("<input>").attr({
                        type: "hidden",
                        name: "_sha_builder_redirect",
                        value: "1"
                    }).appendTo($form);
                    $form.find("#publish, #save-post").first().trigger("click");
                }
            });
        });
        ';

        wp_register_script('sha-builder-edit', '', array('jquery'), SHA_BUILDER_VERSION, true);
        wp_enqueue_script('sha-builder-edit');
        wp_add_inline_script('sha-builder-edit', $script);
    }

    public function redirect_after_builder_save($location, $post_id) {
        if (!isset($_POST['_sha_builder_redirect'])) {
            return $location;
        }
        if (!is_user_logged_in() || !current_user_can('edit_post', $post_id)) {
            return $location;
        }
        return Sha_Builder_Main::instance()->get_builder_url($post_id);
    }

    public function add_main_admin_menu() {
        add_menu_page(
            __('SHA BUILDER', 'sha-builder'),
            __('SHA BUILDER', 'sha-builder'),
            'edit_posts',
            'sha-builder',
            array($this, 'render_config_page'),
            'dashicons-layout',
            30
        );

        add_submenu_page(
            'sha-builder',
            __('Config', 'sha-builder'),
            __('Config', 'sha-builder'),
            'manage_options',
            'sha-builder',
            array($this, 'render_config_page')
        );

        add_submenu_page(
            'sha-builder',
            __('Headers', 'sha-builder'),
            __('Headers', 'sha-builder'),
            'edit_posts',
            'edit.php?post_type=sha_header'
        );

        add_submenu_page(
            'sha-builder',
            __('Footers', 'sha-builder'),
            __('Footers', 'sha-builder'),
            'edit_posts',
            'edit.php?post_type=sha_footer'
        );

        add_submenu_page(
            'sha-builder',
            __('Templates', 'sha-builder'),
            __('Templates', 'sha-builder'),
            'edit_posts',
            'edit.php?post_type=sha_template'
        );

        add_submenu_page(
            'sha-builder',
            __('Globals', 'sha-builder'),
            __('Globals', 'sha-builder'),
            'manage_options',
            'sha-builder-globals',
            array($this, 'render_globals_page')
        );
    }

    public function register_settings() {
        register_setting('sha_builder_settings', 'sha_builder_active_header', 'intval');
        register_setting('sha_builder_settings', 'sha_builder_active_footer', 'intval');
        register_setting('sha_builder_globals_settings', 'sha_builder_global_css');
        register_setting('sha_builder_globals_settings', 'sha_builder_global_js');
    }

    public function render_config_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions.', 'sha-builder'));
        }
        $update_info = $this->check_for_update();
        include SHA_BUILDER_PATH . 'admin/templates/config-page.php';
    }

    public function render_globals_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions.', 'sha-builder'));
        }
        include SHA_BUILDER_PATH . 'admin/templates/globals-page.php';
    }



    public function enqueue_list_assets($hook) {
        if (!in_array($hook, array('edit.php', 'post.php', 'post-new.php'), true)) {
            return;
        }
        $screen = get_current_screen();
        if ($screen && in_array($screen->post_type, Sha_Builder_Main::get_supported_post_types(), true)) {
            $style = '#the-list .sha-edit-link:hover{color:#d86a1f!important;}';
            wp_add_inline_style('list-tables', $style);
        }
    }

    public function body_class($classes) {
        return $classes;
    }

    public function check_for_update() {
        $transient = 'sha_builder_update_check';
        $cached = get_transient($transient);
        if (false !== $cached) {
            return $cached;
        }

        $response = wp_remote_get('https://api.github.com/repos/mshariqq/Sha-Builder/releases/latest', array(
            'timeout' => 10,
            'headers' => array('Accept' => 'application/vnd.github.v3+json'),
        ));

        if (is_wp_error($response) || 200 !== wp_remote_retrieve_response_code($response)) {
            $result = array('has_update' => false, 'new_version' => '', 'url' => '');
            set_transient($transient, $result, HOUR_IN_SECONDS);
            return $result;
        }

        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($data) || empty($data['tag_name'])) {
            $result = array('has_update' => false, 'new_version' => '', 'url' => '');
            set_transient($transient, $result, HOUR_IN_SECONDS);
            return $result;
        }

        $remote_version = ltrim($data['tag_name'], 'vV');
        $has_update = version_compare($remote_version, SHA_BUILDER_VERSION, '>');

        $result = array(
            'has_update'  => $has_update,
            'new_version' => $remote_version,
            'url'         => 'https://github.com/mshariqq/Sha-Builder/releases',
        );

        set_transient($transient, $result, 6 * HOUR_IN_SECONDS);
        return $result;
    }
}
