<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_CPT {

    public function __construct() {
        add_action('init', array($this, 'register_post_types'));
    }

    public function register_post_types() {
        register_post_type('sha_header', array(
            'labels'          => array(
                'name'               => __('Headers', 'sha-builder'),
                'singular_name'      => __('Header', 'sha-builder'),
                'add_new'            => __('Add New Header', 'sha-builder'),
                'add_new_item'       => __('Add New Header', 'sha-builder'),
                'edit_item'          => __('Edit Header', 'sha-builder'),
                'new_item'           => __('New Header', 'sha-builder'),
                'view_item'          => __('View Header', 'sha-builder'),
                'search_items'       => __('Search Headers', 'sha-builder'),
                'not_found'          => __('No headers found', 'sha-builder'),
                'not_found_in_trash' => __('No headers found in Trash', 'sha-builder'),
                'all_items'          => __('All Headers', 'sha-builder'),
            ),
            'public'             => false,
            'publicly_queryable' => false,
            'show_ui'            => true,
            'show_in_menu'       => false,
            'query_var'          => false,
            'rewrite'            => false,
            'capability_type'    => 'page',
            'has_archive'        => false,
            'hierarchical'       => false,
            'supports'           => array('title', 'editor', 'revisions'),
        ));

        register_post_type('sha_footer', array(
            'labels'          => array(
                'name'               => __('Footers', 'sha-builder'),
                'singular_name'      => __('Footer', 'sha-builder'),
                'add_new'            => __('Add New Footer', 'sha-builder'),
                'add_new_item'       => __('Add New Footer', 'sha-builder'),
                'edit_item'          => __('Edit Footer', 'sha-builder'),
                'new_item'           => __('New Footer', 'sha-builder'),
                'view_item'          => __('View Footer', 'sha-builder'),
                'search_items'       => __('Search Footers', 'sha-builder'),
                'not_found'          => __('No footers found', 'sha-builder'),
                'not_found_in_trash' => __('No footers found in Trash', 'sha-builder'),
                'all_items'          => __('All Footers', 'sha-builder'),
            ),
            'public'             => false,
            'publicly_queryable' => false,
            'show_ui'            => true,
            'show_in_menu'       => false,
            'query_var'          => false,
            'rewrite'            => false,
            'capability_type'    => 'page',
            'has_archive'        => false,
            'hierarchical'       => false,
            'supports'           => array('title', 'editor', 'revisions'),
        ));
    }
}
