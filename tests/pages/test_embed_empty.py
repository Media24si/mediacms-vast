import uuid
from django.test import Client, TestCase
from django.urls import reverse

from files.models import Media
from files.tests import create_account


class TestEmbedEmpty(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.password = 'test_password'
        self.user = create_account(password=self.password)
        
        # Create a test media object
        self.media = Media.objects.create(
            title='Test Video for Embed Empty',
            description='Test media for embed-empty endpoint',
            user=self.user,
            media_type='video',
            state='public',
            friendly_token=str(uuid.uuid4())
        )

    def test_embed_empty_endpoint_exists(self):
        """Test that the embed-empty endpoint exists and returns 200 for valid media"""
        client = Client()
        response = client.get(f'/embed-empty?m={self.media.friendly_token}')
        
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'page-embed-empty')

    def test_embed_empty_missing_media_param(self):
        """Test that missing media parameter redirects to root"""
        client = Client()
        response = client.get('/embed-empty')
        
        # Should redirect to home page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

    def test_embed_empty_invalid_media_token(self):
        """Test that invalid media token redirects to root"""
        client = Client()
        response = client.get('/embed-empty?m=invalid-token-123')
        
        # Should redirect to home page 
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

    def test_embed_empty_security_headers(self):
        """Test that proper security headers are set"""
        client = Client()
        response = client.get(f'/embed-empty?m={self.media.friendly_token}')
        
        self.assertEqual(response.status_code, 200)
        
        # Check security headers
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response['X-Frame-Options'], 'SAMEORIGIN')
        self.assertEqual(response['Referrer-Policy'], 'no-referrer-when-downgrade')
        
        # Check CSP header exists
        self.assertIn('Content-Security-Policy', response)
        csp = response['Content-Security-Policy']
        self.assertIn("default-src 'self'", csp)
        self.assertIn("frame-ancestors 'self'", csp)
        self.assertIn("object-src 'none'", csp)

    def test_embed_empty_query_params(self):
        """Test that query parameters are properly handled and validated"""
        client = Client()
        
        # Test with valid parameters
        response = client.get(
            f'/embed-empty?m={self.media.friendly_token}&autoplay=1&muted=1&loop=1&poster=0&start=30&ratio=16:9'
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-autoplay="1"')
        self.assertContains(response, 'data-muted="1"')
        self.assertContains(response, 'data-loop="1"')
        self.assertContains(response, 'data-poster="0"')
        self.assertContains(response, 'data-start="30"')
        self.assertContains(response, 'data-ratio="16:9"')

    def test_embed_empty_param_validation(self):
        """Test parameter validation and sanitization"""
        client = Client()
        
        # Test with invalid/malicious parameters
        response = client.get(
            f'/embed-empty?m={self.media.friendly_token}&autoplay=invalid&muted=<script>&start=-10&ratio=javascript:alert(1)'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Check that invalid values are converted to defaults
        self.assertContains(response, 'data-autoplay="0"')  # invalid -> 0
        self.assertContains(response, 'data-muted="0"')     # invalid -> 0
        self.assertContains(response, 'data-start="0"')     # negative -> 0
        self.assertContains(response, 'data-ratio=""')      # invalid -> empty

    def test_embed_empty_template_content(self):
        """Test that the template contains required elements for empty player"""
        client = Client()
        response = client.get(f'/embed-empty?m={self.media.friendly_token}')
        
        self.assertEqual(response.status_code, 200)
        
        # Check for key elements
        self.assertContains(response, 'page-embed-empty')
        self.assertContains(response, 'data-preset="empty"')
        self.assertContains(response, 'embed-empty.css')
        self.assertContains(response, 'embed-empty.js')
        
        # Check for proper meta tags
        self.assertContains(response, '<meta name="robots" content="noindex, nofollow">')

    def test_embed_empty_caching_headers(self):
        """Test that appropriate caching headers are set"""
        client = Client()
        response = client.get(f'/embed-empty?m={self.media.friendly_token}')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'public, max-age=300')

    def test_embed_empty_defaults(self):
        """Test default parameter values"""
        client = Client()
        response = client.get(f'/embed-empty?m={self.media.friendly_token}')
        
        self.assertEqual(response.status_code, 200)
        
        # Check defaults
        self.assertContains(response, 'data-autoplay="1"')  # default autoplay=1
        self.assertContains(response, 'data-muted="1"')     # default muted=1  
        self.assertContains(response, 'data-loop="0"')      # default loop=0
        self.assertContains(response, 'data-poster="1"')    # default poster=1
        self.assertContains(response, 'data-start="0"')     # default start=0