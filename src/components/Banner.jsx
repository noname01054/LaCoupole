import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function Banner({ banner }) {
  const navigate = useNavigate();

  // Enable smooth scrolling globally once when the app loads
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    // Optional cleanup (not strictly needed)
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const handleClick = () => {
    if (!banner.link) return;

    // External link → open normally
    if (banner.link.startsWith('http')) {
      window.location.href = banner.link;
      return;
    }

    // Internal link → navigate + smooth scroll to top with nice feel
    navigate(banner.link);

    // Small trick: tiny timeout so the new page renders first, then we scroll smoothly
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }, 100);
  };

  return (
    <>
      {/* Inline global styles for smooth scrolling + banner hover effect */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        .banner-container {
          transition: transform 0.4s ease, box-shadow 0.4s ease;
        }

        .banner-container:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        .banner-image {
          transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .banner-container:hover .banner-image {
          transform: scale(1.03);
        }
      `}</style>

      <div
        className="banner-container"
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '20px auto',
          cursor: banner.link ? 'pointer' : 'default',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
        }}
        onClick={handleClick}
      >
        {banner.image_url ? (
          <img
            src={banner.image_url}
            alt="Banner"
            className="banner-image"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              objectFit: 'cover',
            }}
            onError={(e) => {
              console.error('Error loading banner image:', banner.image_url);
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '200px',
              background: '#e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '1.2rem',
            }}
          >
            No banner image
          </div>
        )}
      </div>
    </>
  );
}

export default Banner;
