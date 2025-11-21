import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

function Banner({ banners = [] }) { // Now expects an array of banners
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef(null);

  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (banners.length <= 1) return;

    timeoutRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Change banner every 5 seconds

    return () => clearInterval(timeoutRef.current);
  }, [banners.length]);

  // Reset timer on mouse enter/leave (optional pause on hover)
  const resetTimer = () => {
    clearInterval(timeoutRef.current);
    timeoutRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
  };

  const handleClick = (banner) => {
    if (!banner.link) return;

    if (banner.link.startsWith('http')) {
      window.location.href = banner.link;
    } else {
      navigate(banner.link);
      // Smooth scroll to top after navigation
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    }
  };

  // If no banners or empty array
  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <>
      {/* Smooth Global Styles */}
      <style jsx>{`
        .banner-carousel {
          width: 100%;
          max-width: 1200px;
          margin: 20px auto;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
        }

        .banner-slider {
          display: flex;
          transition: transform 0.8s cubic-bezier(0.5, 0, 0.2, 1);
          width: 100%;
        }

        .banner-item {
          min-width: 100%;
          cursor: pointer;
          user-select: none;
        }

        .banner-item img {
          width: 100%;
          height: auto;
          display: block;
          object-fit: cover;
          border-radius: 12px;
        }

        /* Dots Indicator */
        .dots-container {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 16px;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ccc;
          transition: all 0.3s ease;
        }

        .dot.active {
          background: #007bff;
          transform: scale(1.3);
        }

        /* Hover effect */
        .banner-item:hover img {
          transform: scale(1.03);
          transition: transform 0.8s ease;
        }
      `}</style>

      <div className="banner-carousel"
        onMouseEnter={() => clearInterval(timeoutRef.current)}
        onMouseLeave={resetTimer}
      >
        <div
          className="banner-slider"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {banners.map((banner, index) => (
            <div
              key={banner.id || index}
              className="banner-item"
              onClick={() => handleClick(banner)}
            >
              {banner.image_url ? (
                <img
                  src={banner.image_url}
                  alt={banner.title || "Banner"}
                  onError={(e) => {
                    console.error("Banner load error:", banner.image_url);
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <div style={{
                  height: '300px',
                  background: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  fontSize: '1.5rem'
                }}>
                  No Image
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Dots Indicator */}
        {banners.length > 1 && (
          <div className="dots-container">
            {banners.map((_, index) => (
              <div
                key={index}
                className={`dot ${index === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default Banner;
