require "net/http"
require "benchmark"
require 'binnacle'

module Binnacle
  module HttpLogger

    def self.signal(url, method, host, port, path, query, status, duration, headers = {}, body = nil, encoding = nil, content_type = nil, data = nil)
      return if !self.allow?(url)

      bm = duration ? (duration / 1000) : 0.0

      signal_data = {
        url: url,
        method: method.to_s.upcase,
        host: host,
        port: port,
        path: path,
        query: query,
        format: content_type,
        time: Time.now,
        status: status,
        duration: bm,
        headers: headers,
        body: extract_body_data(body, encoding, content_type),
        data: extract_data(data),
        message: "#{method.to_s.upcase} #{url} AS #{content_type} (duration: #{bm}ms)"
      }

      Binnacle.client.log_http_event(signal_data) if Binnacle.client
    end

    def self.allow?(url)
      unless Binnacle.configuration.url_blacklist_pattern.nil?
        return false if url.to_s.match(Binnacle.configuration.url_blacklist_pattern)
      end

      !url.to_s.match(Binnacle.configuration.url_whitelist_pattern).nil?
    end

    def self.extract_body_data(body, encoding = nil, content_type=nil)
      return unless text_based?(content_type)

      # open-uri wraps the response in a Net::ReadAdapter that defers reading
      # the content, so the reponse body is not available here.
      return if body.is_a?(Net::ReadAdapter)

      if encoding =~ /gzip/
        begin
          sio = StringIO.new( body.to_s )
          gz = Zlib::GzipReader.new( sio )
          body = gz.read
        rescue
          # nothing to see here, move along!
        end
      end

      utf_encoded(body.to_s, content_type)
    end

    def self.extract_data(data)
      utf_encoded(data.to_s)
    end

    private

    def self.utf_encoded(data, content_type=nil)
      charset = content_type.to_s.scan(/; charset=(\S+)/).flatten.first || 'UTF-8'
      data.force_encoding(charset) rescue data.force_encoding('UTF-8')
      data.encode('UTF-8', :invalid => :replace, :undef => :replace)
    end

    def self.text_based?(content_type)
      # This is a very naive way of determining if the content type is text-based; but
      # it will allow application/json and the like without having to resort to more
      # heavy-handed checks.
      content_type =~ /^text/ ||
      content_type =~ /^application/ && content_type != 'application/octet-stream'
    end

  end
end
