<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Admin {

    public function __construct() {
        add_action('admin_menu', array($this, 'add_builder_page_fallback'));
        add_action('admin_menu', array($this, 'add_main_admin_menu'), 9);
        add_action('admin_init', array($this, 'register_settings'));
        add_filter('page_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_filter('post_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_filter('sha_header_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_filter('sha_footer_row_actions', array($this, 'add_edit_with_sha_button'), 10, 2);
        add_action('add_meta_boxes', array($this, 'add_builder_meta_box'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_list_assets'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_edit_screen_script'));
        add_filter('redirect_post_location', array($this, 'redirect_after_builder_save'), 10, 2);
        add_filter('admin_body_class', array($this, 'body_class'));
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

    public function render_builder_meta_box($post) {
        if (!current_user_can('edit_post', $post->ID) && !current_user_can('edit_posts')) {
            echo '<p>' . esc_html__('You do not have permission.', 'sha-builder') . '</p>';
            return;
        }
        $builder_url = Sha_Builder_Main::instance()->get_builder_url($post->ID);
        $post_type_object = get_post_type_object($post->post_type);
        $label = $post_type_object ? strtolower($post_type_object->labels->singular_name) : __('page', 'sha-builder');
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
        <?php
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
    }

    public function register_settings() {
        register_setting('sha_builder_settings', 'sha_builder_active_header', 'intval');
        register_setting('sha_builder_settings', 'sha_builder_active_footer', 'intval');
    }

    public function render_config_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions.', 'sha-builder'));
        }
        include SHA_BUILDER_PATH . 'admin/templates/config-page.php';
    }

    public function add_builder_page_fallback() {
        add_submenu_page(
            null,
            __('Sha Builder (fallback)', 'sha-builder'),
            __('Sha Builder (fallback)', 'sha-builder'),
            'edit_posts',
            'sha-builder-fallback',
            array($this, 'render_builder_page_fallback')
        );
    }

    public function render_builder_page_fallback() {
        if (!is_user_logged_in()) {
            wp_die(__('You must be logged in to access the builder.', 'sha-builder'), 401);
        }

        if (!isset($_GET['post_id'])) {
            wp_die(__('No page selected.', 'sha-builder'));
        }

        $post_id = intval($_GET['post_id']);
        $post = get_post($post_id);
        if (!$post || !in_array($post->post_type, Sha_Builder_Main::get_supported_post_types(), true)) {
            wp_die(__('Invalid page.', 'sha-builder'), 404);
        }
        if (!current_user_can('edit_post', $post_id)) {
            wp_die(__('Permission denied.', 'sha-builder'), 403);
        }

        while (ob_get_level()) {
            ob_end_clean();
        }

        $saved_data = get_post_meta($post_id, '_sha_builder_data', true);
        if (!is_array($saved_data)) {
            $saved_data = array(
                'html' => '<div style="padding:60px 40px;text-align:center;font-family:Arial,sans-serif;color:#333;"><h1 style="margin:0 0 12px;font-size:28px;">Start Building</h1><p style="font-size:16px;color:#666;">Add your HTML code in the editor panel and click Render.</p></div>',
                'css'  => '',
                'js'   => '',
            );
        }

        $main = Sha_Builder_Main::instance();
        if (method_exists($main, 'send_security_headers')) {
            $main->send_security_headers();
        }

        show_admin_bar(false);

        wp_enqueue_style(
            'sha-builder-builder',
            SHA_BUILDER_URL . 'admin/css/builder.css',
            array(),
            SHA_BUILDER_VERSION
        );

        wp_enqueue_script(
            'sha-builder-builder',
            SHA_BUILDER_URL . 'admin/js/builder.js',
            array('jquery'),
            SHA_BUILDER_VERSION,
            true
        );

        wp_localize_script('sha-builder-builder', 'shaBuilder', array(
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('sha_builder_nonce'),
            'postId'   => $post_id,
            'closeUrl' => admin_url('edit.php?post_type=' . urlencode(get_post_type($post_id))),
            'strings'  => array(
                'saveSuccess' => __('Page saved successfully!', 'sha-builder'),
                'saveError'   => __('Error saving page. Please try again.', 'sha-builder'),
                'saving'      => __('Saving...', 'sha-builder'),
                'save'        => __('Save', 'sha-builder'),
                'render'      => __('Render', 'sha-builder'),
                'unsaved'     => __('You have unsaved changes. Are you sure you want to leave?', 'sha-builder'),
            ),
        ));

        include SHA_BUILDER_PATH . 'admin/templates/builder-page.php';
        exit;
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
        if (isset($_GET['page']) && 'sha-builder-fallback' === $_GET['page']) {
            $classes .= ' sha-builder-active';
        }
        return $classes;
    }
}
